{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs-13_x
    (yarn.override { nodejs = nodejs-13_x; })
    yarn2nix
  ];

  ELECTRON_OVERRIDE_DIST_PATH = "${pkgs.electron_8}/bin/";
}
