import React from 'react'
import styled from 'styled-components'
import Dialog from '../material/dialog'
import { VERSION, KEY, shouldShowChangelog } from './should-show-changelog'

import changelogContent from '../../CHANGELOG.md'
import { colorTextSecondary, colorTextPrimary } from '../styles/colors'
import { subtitle1, headline5, headline6 } from '../styles/typography'
const changelogHtml = { __html: changelogContent }

const Content = styled.div`
  user-select: contain;

  * {
    user-select: text;
  }

  > *:first-child {
    margin-top: 0px;
    padding-top: 0px;
  }

  > *:last-child {
    margin-bottom: 0px;
    padding-top: 0px;
  }

  ul {
    padding-left: 20px;
  }

  li {
    ${subtitle1};
    margin-top: 8px;
    color: ${colorTextSecondary};
  }

  li + li {
    margin-top: 16px;
  }

  h4 {
    ${headline5};
    margin-bottom: 8px;
  }

  h5 {
    ${headline6};
    margin-bottom: 8px;
  }

  strong {
    color: ${colorTextPrimary};
    font-weight: 500;
  }

  code {
    font-size: inherit;
  }
`

export default class ChangelogDialog extends React.Component {
  _setting = false

  componentDidMount() {
    window.addEventListener('storage', this.onStorageChange)
  }

  componentWillUnmount() {
    window.removeEventListener('storage', this.onStorageChange)
  }

  render() {
    return (
      <Dialog
        title={"What's new"}
        onCancel={this.onDismiss}
        showCloseButton={true}
        dialogRef={this.props.dialogRef}>
        <Content dangerouslySetInnerHTML={changelogHtml} />
      </Dialog>
    )
  }

  onStorageChange = e => {
    if (!this._setting && e.key === KEY) {
      if (!shouldShowChangelog()) {
        this.onDismiss()
      }
    }
  }

  onDismiss = () => {
    this._setting = true
    window.localStorage.setItem(KEY, VERSION)
    this._setting = false
    if (this.props.onCancel) {
      this.props.onCancel()
    }
  }
}
