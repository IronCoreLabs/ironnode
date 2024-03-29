{
  description = "Ironnode";
  inputs.flake-utils.url = "github:numtide/flake-utils";

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        lib = import <nixpkgs/lib>;
        pkgs = nixpkgs.legacyPackages.${system};
      in
      rec {
        devShell = pkgs.mkShell {
          buildInputs = with pkgs.nodePackages; [
            pkgs.nodejs-18_x
            pkgs.protobuf
            (pkgs.yarn.override { nodejs = pkgs.nodejs-18_x; })
          ];
        };
      });
}
