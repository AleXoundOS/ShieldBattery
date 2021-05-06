with (import <nixpkgs> {});
let
  inherit (import (builtins.fetchTarball "https://github.com/hercules-ci/gitignore/archive/master.tar.gz") { }) gitignoreSource;
in
{
  ShieldBattery = mkYarnPackage {
    name = "ShieldBattery";
    src = gitignoreSource ./.;
    packageJSON = ./package.json;
    yarnLock = ./yarn.lock;
    yarnNix = ./yarn.nix;
  };
}
