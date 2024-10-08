import '@typechain/hardhat';
import "hardhat-contract-sizer";
import '@nomiclabs/hardhat-ethers'
import { HardhatUserConfig } from "hardhat/types";

const privateKeys = [
    "0xf2f48ee19680706196e2e339e5da3491186e0c4c5030670656b0e0164837257d",
    "0x5d862464fe9303452126c8bc94274b8c5f9874cbd219789b3eb2128075a76f72",
    "0xdf02719c4df8b9b8ac7f551fcb5d9ef48fa27eef7a66453879f4d8fdc6e78fb1",
    "0xff12e391b79415e941a94de3bf3a9aee577aed0731e297d5cfa0b8a1e02fa1d0",
    "0x752dd9cf65e68cfaba7d60225cbdbc1f4729dd5e5507def72815ed0d8abc6249",
    "0xefb595a0178eb79a8df953f87c5148402a224cdf725e88c0146727c6aceadccd",
    "0x83c6d2cc5ddcf9711a6d59b417dc20eb48afd58d45290099e5987e3d768f328f",
    "0xbb2d3f7c9583780a7d3904a2f55d792707c345f21de1bacb2d389934d82796b2",
    "0xb2fd4d29c1390b71b8795ae81196bfd60293adf99f9d32a0aff06288fcdac55f",
  ];
function viaIR(version: string, runs: number) {
    return {
        version,
        settings: {
            optimizer: {
                enabled: true,
                runs: runs,
            },
            evmVersion: 'paris',
            viaIR: true,
        },
    };
}

const config: HardhatUserConfig = {
    paths: {
        sources: './contracts',
        tests: './test',
        artifacts: "./build/artifacts",
        cache: "./build/cache"
    },
    solidity: {
        compilers: [
            {
                version: '0.8.23',
                settings: {
                    optimizer: {
                        enabled: true,
                        runs: 0,
                    },
                    evmVersion: 'paris'
                },
            }
        ],
        overrides: {
            'contracts/router/ActionAddRemoveLiqV3.sol': viaIR('0.8.23', 10000),
            'contracts/router/ActionMiscV3.sol': viaIR('0.8.23', 1000000),
            'contracts/router/ActionSwapPTV3.sol': viaIR('0.8.23', 1000000),
            'contracts/router/ActionSwapYTV3.sol': viaIR('0.8.23', 1000000),
            'contracts/router/ActionCallbackV3.sol': viaIR('0.8.23', 1000000),
            'contracts/router/PendleRouterV3.sol': viaIR('0.8.23', 1000000),
            'contracts/limit/PendleLimitRouter.sol': viaIR('0.8.23', 1000000),
        },
    },
    contractSizer: {
        disambiguatePaths: false,
        runOnCompile: false,
        strict: true,
        only: [],
    },
    
  networks: {
    hardhat: {
      allowUnlimitedContractSize: true,
      forking: undefined,
      accounts: getHardhatPrivateKeys(),
      gas: 30193413,
      blockGasLimit: 120000000,
      chainId: 31338
    },
    arblocalhost: {
      url: "https://rpc.vnet.tenderly.co/devnet/arb-forked/8e4d5a7a-0867-4f2a-a0d7-bfa0ae596cf6",
      gas: 80000000,
      timeout: 2000000,
      blockGasLimit: 702056136595,
      gasPrice: 489979591000,
      // accounts: getHardhatPrivateKeys(),
      allowUnlimitedContractSize :true
    },
  },
};
function getHardhatPrivateKeys() {
    return privateKeys.map(key => {
      const ONE_MILLION_ETH = "1000000000000000000000000";
      return {
        privateKey: key,
        balance: ONE_MILLION_ETH,
      };
    });
  }


export default config;
