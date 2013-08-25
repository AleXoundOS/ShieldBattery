var modName = 'shieldbattery.initializer'
module.exports = modName
var mod = angular.module(modName, [])

mod.run(function($rootScope, psiSocket) {
  // After the first route change completes, we'll mark the application as loaded.
  // Theoretically, this works. If we end up needing some more complex logic, we should probably
  // keep some sort of registry of things being initialized so we know when they complete.
  // Alternatively, pull the $routeChangeStart hijacking from auth into here, and make registrations
  // add new promises to the intial route change.

  // Enough what if's, let's do the thing!
  var unregSuccess = $rootScope.$on('$routeChangeSuccess', doIt)
    , unregError = $rootScope.$on('$routeChangeError', doIt)

  function doIt() {
    $rootScope.appInitialized = true
    unregSuccess()
    unregError()
  }

  psiSocket.connect()
})
