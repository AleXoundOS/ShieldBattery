import React from 'react'
import { Route } from 'react-router-dom'

import LoginLayout from '../auth/login-layout'

// A custom route for all the components that needs to be wrapped in <LoginLayout>
export const LoginRoute = ({ component: Component, ...rest }) => (
  <Route
    {...rest}
    render={props => (
      <LoginLayout>
        <Component {...props} />
      </LoginLayout>
    )}
  />
)

// A route that conditionally renders a component based on the list of filters it receives
// Note: Filters are resolved in the order they are placed in the array
export const ConditionalRoute = ({ path, filters, ...rest }) =>
  filters
    .slice() // Don't mutate the original array
    .reverse()
    .reduce(
      (children, Filter) => <Filter path={path}>{children}</Filter>,
      <Route path={path} {...rest} />,
    )
