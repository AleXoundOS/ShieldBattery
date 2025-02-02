import bcrypt from 'bcrypt'
import cuid from 'cuid'
import httpErrors from 'http-errors'
import util from 'util'
import createThrottle from '../throttle/create-throttle'
import throttleMiddleware from '../throttle/middleware'
import users from '../models/users'
import initSession from '../session/init'
import sendMail from '../mail/mailer'
import { checkAnyPermission } from '../permissions/check-permissions'
import { usePasswordResetCode } from '../models/password-resets'
import {
  addEmailVerificationCode,
  getEmailVerificationsCount,
  consumeEmailVerificationCode,
} from '../models/email-verifications'
import { isValidUsername, isValidEmail, isValidPassword } from '../../../common/constants'
import { UNIQUE_VIOLATION } from '../db/pg-error-codes'
import transact from '../db/transaction'
import updateAllSessions from '../session/update-all-sessions'
import ensureLoggedIn from '../session/ensure-logged-in'

const accountCreationThrottle = createThrottle('accountcreation', {
  rate: 1,
  burst: 4,
  window: 60000,
})

const accountUpdateThrottle = createThrottle('accountupdate', {
  rate: 10,
  burst: 20,
  window: 60000,
})

const emailVerificationThrottle = createThrottle('emailverification', {
  rate: 10,
  burst: 20,
  window: 12 * 60 * 60 * 1000,
})

const sendVerificationThrottle = createThrottle('sendverification', {
  rate: 4,
  burst: 4,
  window: 12 * 60 * 60 * 1000,
})

export default function (router, { nydus }) {
  router
    .post(
      '/',
      throttleMiddleware(accountCreationThrottle, ctx => ctx.ip),
      createUser,
    )
    .get('/:searchTerm', checkAnyPermission('banUsers', 'editPermissions'), find)
    .patch(
      '/:id',
      throttleMiddleware(accountUpdateThrottle, ctx => ctx.session.userId),
      ensureLoggedIn,
      updateUser,
    )
    .post('/:username/password', resetPassword)
    .post(
      '/emailVerification',
      throttleMiddleware(emailVerificationThrottle, ctx => ctx.session.userId),
      ensureLoggedIn,
      (ctx, next) => verifyEmail(ctx, next, nydus),
    )
    .post(
      '/sendVerification',
      throttleMiddleware(sendVerificationThrottle, ctx => ctx.session.userId),
      ensureLoggedIn,
      sendVerificationEmail,
    )
}

async function find(ctx, next) {
  const searchTerm = ctx.params.searchTerm

  try {
    const user = await users.find(searchTerm)
    ctx.body = user ? [user] : []
  } catch (err) {
    throw err
  }
}

const bcryptHash = util.promisify(bcrypt.hash)
function hashPass(password) {
  return bcryptHash(password, 10)
}

async function createUser(ctx, next) {
  const { username, password } = ctx.request.body
  const email = ctx.request.body.email.trim()

  if (!isValidUsername(username) || !isValidEmail(email) || !isValidPassword(password)) {
    throw new httpErrors.BadRequest('Invalid parameters')
  }

  const hashed = await hashPass(password)

  let result
  try {
    const user = users.create(username, email, hashed, ctx.ip)
    result = await user.save()
  } catch (err) {
    if (err.code && err.code === UNIQUE_VIOLATION) {
      throw new httpErrors.Conflict('A user with that name already exists')
    }
    throw err
  }

  // regenerate the session to ensure that logged in sessions and anonymous sessions don't
  // share a session ID
  await ctx.regenerateSession()
  initSession(ctx, result.user, result.permissions)

  const code = cuid()
  await addEmailVerificationCode(result.user.id, email, code, ctx.ip)
  // No need to await for this
  sendMail({
    to: email,
    subject: 'ShieldBattery Email Verification',
    templateName: 'email-verification',
    templateData: { token: code },
  }).catch(err => ctx.log.error({ err }, 'Error sending email verification email'))

  ctx.body = result
}

const bcryptCompare = util.promisify(bcrypt.compare)
async function updateUser(ctx, next) {
  let { id } = ctx.params
  const { currentPassword, newPassword, newEmail } = ctx.request.body

  id = parseInt(id, 10)
  if (!id || isNaN(id)) {
    throw new httpErrors.BadRequest('Invalid parameters')
  } else if (newPassword && !isValidPassword(newPassword)) {
    throw new httpErrors.BadRequest('Invalid parameters')
  } else if (newEmail && !isValidEmail(newEmail)) {
    throw new httpErrors.BadRequest('Invalid parameters')
  }

  const user = await users.find(id)
  const oldEmail = user.email

  // Changing email and password requires a correct current password to be entered
  if (newPassword || newEmail) {
    if (!isValidPassword(currentPassword)) {
      throw new httpErrors.BadRequest('Invalid parameters')
    }

    const same = await bcryptCompare(currentPassword, user.password)
    if (!same) {
      throw new httpErrors.Unauthorized('Incorrect password')
    }
  }

  if (newPassword) {
    user.password = await hashPass(newPassword)
  }
  if (newEmail) {
    user.email = newEmail
    user.emailVerified = false
  }
  await user.save()

  // No need to await this before sending response to the user
  if (newPassword) {
    sendMail({
      to: user.email,
      subject: 'ShieldBattery Password Changed',
      templateName: 'password-change',
      templateData: { username: user.name },
    }).catch(err => ctx.log.error({ err }, 'Error sending password changed email'))
  }
  if (newEmail) {
    sendMail({
      to: oldEmail,
      subject: 'ShieldBattery Email Changed',
      templateName: 'email-change',
      templateData: { username: user.name },
    }).catch(err => ctx.log.error({ err }, 'Error sending email changed email'))

    const emailVerificationCode = cuid()
    await addEmailVerificationCode(user.id, user.email, emailVerificationCode, ctx.ip)
    await updateAllSessions(ctx, { emailVerified: false })

    sendMail({
      to: user.email,
      subject: 'ShieldBattery Email Verification',
      templateName: 'email-verification',
      templateData: { token: emailVerificationCode },
    }).catch(err => ctx.log.error({ err }, 'Error sending email verification email'))
  }

  // TODO(tec27): Patch requests should really return the whole entity
  ctx.body = { email: user.email, emailVerified: user.emailVerified }
}

async function resetPassword(ctx, next) {
  const { username } = ctx.params
  const { code } = ctx.query
  const { password } = ctx.request.body

  if (!code || !isValidUsername(username) || !isValidPassword(password)) {
    throw new httpErrors.BadRequest('Invalid parameters')
  }

  await transact(async client => {
    try {
      await usePasswordResetCode(client, username, code)
    } catch (err) {
      throw new httpErrors.BadRequest('Password reset code is invalid')
    }

    const user = await users.find(username)
    user.password = await hashPass(password)
    await user.save()
    ctx.status = 204
  })
}

async function verifyEmail(ctx, next, nydus) {
  const { code } = ctx.query

  if (!code) {
    throw new httpErrors.BadRequest('Invalid parameters')
  }

  const user = await users.find(ctx.session.userId)
  if (!user) {
    throw new httpErrors.BadRequest('User not found')
  }

  const emailVerified = await consumeEmailVerificationCode(user.id, user.email, code)
  if (!emailVerified) {
    throw new httpErrors.BadRequest('Email verification code is invalid')
  }

  // Update all of the user's sessions to indicate that their email is now indeed verified.
  await updateAllSessions(ctx, { emailVerified: true })

  // Last thing to do is to notify all of the user's opened sockets that their email is now verified
  // NOTE(2Pac): With the way the things are currently set up on client (their socket is not
  // connected when they open the email verification page), the client making the request won't
  // actually get this event. Thankfully, that's easy to deal with on the client-side.
  nydus.publish('/userProfiles/' + ctx.session.userId, { action: 'emailVerified' })
  // TODO(tec27): get the above path from UserSocketsGroup instead of just concat'ing things
  // together here

  ctx.status = 204
}

async function sendVerificationEmail(ctx, next) {
  const user = await users.find(ctx.session.userId)
  if (!user) {
    throw new httpErrors.BadRequest('User not found')
  }

  const emailVerificationsCount = await getEmailVerificationsCount(user.id, user.email)
  if (emailVerificationsCount > 10) {
    throw new httpErrors.Conflict('Email is over verification limit')
  }

  const code = cuid()
  await addEmailVerificationCode(user.id, user.email, code, ctx.ip)
  // No need to await for this
  sendMail({
    to: user.email,
    subject: 'ShieldBattery Email Verification',
    templateName: 'email-verification',
    templateData: { token: code },
  }).catch(err => ctx.log.error({ err }, 'Error sending email verification email'))

  ctx.status = 204
}
