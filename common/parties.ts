/**
 * The maximum number of players allowed to be in the same party at once. Note that this only
 * restricts the amount of players *in* the party, it doesn't limit the number of invites to the
 * party.
 */
export const MAX_PARTY_SIZE = 8

export interface PartyUser {
  id: number
  name: string
}

export interface AddInvitePayload {
  partyId: string
  from: PartyUser
}

export interface RemoveInvitePayload {
  partyId: string
}

export interface InitPayload {
  id: string
  invites: Array<PartyUser>
  members: Array<PartyUser>
  leader: PartyUser
}
