{
  description = "flunky.bet — Vue 3 + Supabase web app dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22
            pkgs.pnpm
            pkgs.supabase-cli
          ];

          shellHook = ''
            echo "flunky.bet dev shell — node $(node --version), pnpm $(pnpm --version)"
          '';
        };
      }
    );
}
