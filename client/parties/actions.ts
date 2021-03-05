import { AddInvitePayload, InitPayload, RemoveInvitePayload } from '../../common/parties'
import { BaseFetchFailure } from '../network/fetch-action-types'

export type PartiesActions =
  | InviteToPartyBegin
  | InviteToPartySuccess
  | BaseFetchFailure<'@parties/inviteToParty'>
  | DeclinePartyInviteBegin
  | DeclinePartyInviteSuccess
  | BaseFetchFailure<'@parties/declinePartyInvite'>
  | AcceptPartyInviteBegin
  | AcceptPartyInviteSuccess
  | BaseFetchFailure<'@parties/acceptPartyInvite'>
  | AddInvite
  | RemoveInvite
  | Init

export interface InviteToPartyBegin {
  type: '@parties/inviteToPartyBegin'
}

export interface InviteToPartySuccess {
  type: '@parties/inviteToParty'
  payload: void
  error?: false
}

export interface DeclinePartyInviteBegin {
  type: '@parties/declinePartyInviteBegin'
}

export interface DeclinePartyInviteSuccess {
  type: '@parties/declinePartyInvite'
  payload: void
  error?: false
}

export interface AcceptPartyInviteBegin {
  type: '@parties/acceptPartyInviteBegin'
}

export interface AcceptPartyInviteSuccess {
  type: '@parties/acceptPartyInvite'
  payload: void
  error?: false
}

export interface AddInvite {
  type: '@parties/addInvite'
  payload: AddInvitePayload
}

export interface RemoveInvite {
  type: '@parties/removeInvite'
  payload: RemoveInvitePayload
}

export interface Init {
  type: '@parties/init'
  payload: InitPayload
}
