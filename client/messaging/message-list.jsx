import React from 'react'
import PropTypes from 'prop-types'
import styled from 'styled-components'

import { ChatMessage } from './message'
import {
  JoinChannelMessage,
  LeaveChannelMessage,
  NewChannelOwnerMessage,
  SelfJoinChannelMessage,
  UserOnlineMessage,
  UserOfflineMessage,
} from './message-types'
import { ScrollableContent } from '../material/scroll-bar'
import LoadingIndicator from '../progress/dots'

const LoadingArea = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 32px;
`

const MessagesScrollableView = styled.div`
  padding: 8px 16px 0px 8px;
`

const Messages = styled.div`
  padding: 8px 0 0;
  user-select: contain;

  & * {
    user-select: text;
  }
`

// TODO(tec27): make this a user setting
const ONLINE_OFFLINE_DISABLED = true

// This contains just the messages, to avoid needing to re-render them all if e.g. loading state
// changes on the actual message list
class PureMessageList extends React.Component {
  shouldComponentUpdate(nextProps) {
    return this.props.messages !== nextProps.messages
  }

  renderMessage(msg) {
    const { id, type } = msg
    switch (type) {
      case 'joinChannel':
        return <JoinChannelMessage key={id} record={msg} />
      case 'leaveChannel':
        return <LeaveChannelMessage key={id} record={msg} />
      case 'message':
        return <ChatMessage key={id} user={msg.from} time={msg.time} text={msg.text} />
      case 'newOwner':
        return <NewChannelOwnerMessage key={id} record={msg} />
      case 'selfJoinChannel':
        return <SelfJoinChannelMessage key={id} record={msg} />
      case 'userOnline':
        return ONLINE_OFFLINE_DISABLED ? null : <UserOnlineMessage key={id} record={msg} />
      case 'userOffline':
        return ONLINE_OFFLINE_DISABLED ? null : <UserOfflineMessage key={id} record={msg} />
      default:
        return null
    }
  }

  render() {
    return <Messages>{this.props.messages.map(msg => this.renderMessage(msg))}</Messages>
  }
}

export default class MessageList extends React.Component {
  static propTypes = {
    messages: PropTypes.object.isRequired,
    // Whether we are currently requesting more history for this message list
    loading: PropTypes.bool,
    // Whether this message list has more history available that could be requested
    hasMoreHistory: PropTypes.bool,
    onScrollUpdate: PropTypes.func,
  }

  constructor(props) {
    super(props)

    this.scrollable = null
    this._setScrollableRef = elem => {
      this.scrollable = elem
    }
  }

  shouldComponentUpdate(nextProps) {
    return (
      this.props.messages !== nextProps.messages ||
      this.props.loading !== nextProps.loading ||
      this.props.hasMoreHistory !== nextProps.hasMoreHistory ||
      this.props.onScrollUpdate !== nextProps.onScrollUpdate
    )
  }

  renderLoadingArea() {
    if (!this.props.loading && !this.props.hasMoreHistory) {
      // TODO(tec27): Render something telling users they've reached the beginning
      return null
    }

    return <LoadingArea>{this.props.loading ? <LoadingIndicator /> : null}</LoadingArea>
  }

  render() {
    return (
      <ScrollableContent
        ref={this._setScrollableRef}
        autoScroll={true}
        onUpdate={this.props.onScrollUpdate}
        viewElement={<MessagesScrollableView />}>
        {this.renderLoadingArea()}
        <PureMessageList messages={this.props.messages} />
      </ScrollableContent>
    )
  }

  // Set a flag that indicates whether or not we are inserting content at the top of the scrollable
  // list. This allows us to better decide how to adjust scroll position (e.g. to try and keep the
  // same top element visible or not)
  setInsertingAtTop(insertingAtTop) {
    this.scrollable.setInsertingAtTop(insertingAtTop)
  }
}
