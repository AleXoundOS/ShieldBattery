import React from 'react'
import { Link, Route, Switch } from 'wouter'
import { hot } from 'react-hot-loader/root'
import styled from 'styled-components'

import DevActivities from './activities/devonly/routes'
import { DevGames } from './games/devonly/routes'
import { DevLadder } from './ladder/devonly/routes'
import DevLists from './lists/devonly/routes'
import DevLobbies from './lobbies/devonly/routes'
import DevMatchmaking from './matchmaking/devonly/routes'
import DevMaterial from './material/devonly/routes'
import { colorDividers } from './styles/colors'

const Container = styled.div`
  padding: 0 !important;
`

const DescriptionText = styled.div`
  margin: 8px 0;
`

const HomeLink = styled.div`
  width: 100%;
  height: 32px;
  padding-left: 16px;
  line-height: 32px;
  border-bottom: 1px solid ${colorDividers};

  -webkit-app-region: drag;

  & a {
    -webkit-app-region: no-drag;
  }
`

const Content = styled.div`
  height: calc(100% - 32px);
`

class DevDashboard extends React.Component {
  render() {
    return (
      <div>
        <DescriptionText>
          This is a corner dedicated to developers. Here you can inspect and test various components
          of the app.
        </DescriptionText>
        <ul>
          <li>
            <Link href='/dev/activities'>Activity components</Link>
          </li>
          <li>
            <Link href='/dev/games'>Games components</Link>
          </li>
          <li>
            <Link href='/dev/ladder'>Ladder components</Link>
          </li>
          <li>
            <Link href='/dev/lists'>List components</Link>
          </li>
          <li>
            <Link href='/dev/lobbies'>Lobby components</Link>
          </li>
          <li>
            <Link href='/dev/matchmaking'>Matchmaking components</Link>
          </li>
          <li>
            <Link href='/dev/material'>Material components</Link>
          </li>
        </ul>
      </div>
    )
  }
}

class Dev extends React.Component {
  render() {
    return (
      <Container>
        <HomeLink>
          <Link href='/'>Home</Link>
        </HomeLink>
        <Content>
          <Switch>
            <Route path='/dev/activities/:rest*' component={DevActivities} />
            <Route path='/dev/games/:rest*' component={DevGames} />
            <Route path='/dev/ladder/:rest*' component={DevLadder} />
            <Route path='/dev/lists/:rest*' component={DevLists} />
            <Route path='/dev/lobbies/:rest*' component={DevLobbies} />
            <Route path='/dev/matchmaking/:rest*' component={DevMatchmaking} />
            <Route path='/dev/material/:rest*' component={DevMaterial} />
            <Route component={DevDashboard} />
          </Switch>
        </Content>
      </Container>
    )
  }
}

// NOTE(tec27): @loadable/component seems to screw with react-hot-loader in weird ways, so we make
// this root it's own hot context to keep things working inside here
export default hot(Dev)
