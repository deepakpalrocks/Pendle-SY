import hre from "hardhat";
import { ethers, network } from "hardhat";
import masterMagpieABI from "./ABI/masterMagpieABI.json";
import wombatStakingABI from "./ABI/wombatStaking.json";
import poolHelperABI from "./ABI/wombatPoolHelper.json";
import { ERC20, ERC20__factory, PendleMagpieSY } from "../typechain-types";
import { JsonRpcSigner } from "@ethersproject/providers";
// import { ether } from '@utils/common';
import { BigNumber } from "ethers";

// Arguments needed for PendleMagpieSY constructor
const _name = "mPendle";
const _symbol = "mPendle";
const _depositToken = "0xB688BA096b7Bb75d7841e47163Cd12D18B36A5bF";
const _lpToken = "0x2a20202A6F740200BA188F6D72fa72a08a346Aaa";
const _PNP = "0x2Ac2B254Bc18cD4999f64773a966E4f4869c34Ee";
const _wombatPool = "0xe7159f15e7b1d6045506B228A1ed2136dcc56F48";
const _poolHelperAddress = "";
const _masterMagpie = "";

// globale contract uilities
let pendleMagpieSY: PendleMagpieSY;
let magpieSYContract: any;

let depositTokenContract: any;
let lpTokenContract: any;
let PNPContract: any;
let masterMagpieContract: any;
let poolHelperContract: any;

// impersonate addresses
let depositTokenWhaleAddr = "0x04e8dd7411292a967f159e98ff248b119c14a328";
let depositTokenWhaleWallet: JsonRpcSigner;
let admin, player1, player2;

const init = async () => {
  [admin, player1, player2] = await ethers.getSigners();

  await player1.sendTransaction({ to: depositTokenWhaleAddr, value: ethers.utils.parseEther("100") });

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [depositTokenWhaleAddr],
  });

  depositTokenWhaleWallet = ethers.provider.getSigner(depositTokenWhaleAddr);
  masterMagpieContract = new ethers.Contract(_masterMagpie, masterMagpieABI, player1);
  poolHelperContract = new ethers.Contract(_poolHelperAddress, poolHelperABI, player1);

  depositTokenContract = await ERC20__factory.connect(_depositToken, depositTokenWhaleWallet);
  PNPContract = await ERC20__factory.connect(_PNP, depositTokenWhaleWallet);
  lpTokenContract = await ERC20__factory.connect(_lpToken, depositTokenWhaleWallet);
  // masterMagpieContract=await MasterMagpie__factory.connect()
};

const deploy = async () => {
  let PendleMagpieSY: any = await ethers.getContractFactory("PendleMagpieSY");
  pendleMagpieSY = await PendleMagpieSY.deploy(_name, _symbol, _lpToken, _depositToken, _wombatPool, _poolHelperAddress);

  await pendleMagpieSY.deployed();
  console.log("PendleMagpieSY deployed to:", pendleMagpieSY.address);
  magpieSYContract = await ethers.getContractAt("PendleMagpieSY", pendleMagpieSY.address);
};

const depositSY = async (account: JsonRpcSigner, fromToken: ERC20, amount: BigNumber, HarvestBeforeDeposit: boolean) => {
  console.log("======== deposit SY ========");
  let stakedAmt = (await masterMagpieContract.stakingInfo(_depositToken, magpieSYContract.address)).stakedAmount;
  let beforeShares = await magpieSYContract.balanceOf(await account.getAddress());
  console.log("Amount of deposit token staked in SY before deposit:", stakedAmt);

  if (HarvestBeforeDeposit) await poolHelperContract.harvest();

  await fromToken.connect(account).approve(magpieSYContract.address, amount);
  console.log(`expected shares to recieve ${await magpieSYContract.previewDeposit(fromToken.address, amount)} from depsit with ${await fromToken.symbol()}`);

  await magpieSYContract.connect(account).deposit(await account.getAddress(), fromToken.address, amount, 0);
  stakedAmt = (await masterMagpieContract.stakingInfo(_depositToken, magpieSYContract.address)).stakedAmount;
  console.log("Amount of deposit token staked in SY after deposit:", stakedAmt);

  console.log(`Shares recieved by user: ${(await magpieSYContract.balanceOf(await account.getAddress())).sub(beforeShares)} - shares`);
};

const redeemSY = async (account: JsonRpcSigner, targetToken: ERC20, shareAmount: BigNumber) => {
  console.log("======== redeem SY ========");
  let beforeShares = await magpieSYContract.balanceOf(await account.getAddress());
  let targetBefore = await targetToken.balanceOf(await account.getAddress());

  console.log(`preview redeemTo ${await targetToken.symbol()}: ${await magpieSYContract.previewRedeem(targetToken.address, shareAmount)}`);
  await magpieSYContract.connect(account).redeem(await account.getAddress(), shareAmount, targetToken.address, 0, false);
  console.log(`Shares burn: ${beforeShares.sub(await magpieSYContract.balanceOf(await account.getAddress()))}`);
  console.log(`${await targetToken.symbol()} Received: ${(await targetToken.balanceOf(await account.getAddress())).sub(targetBefore)}`);
};

async function main() {
  // Get the Contract Factory
  await init();
  await deploy();

  /*================ Simulation =======================*/
  const myAddr = "0x5409ED021D9299bf6814279A6A1411A7e866A631";
  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [myAddr],
  });
  const myWallet = ethers.provider.getSigner(myAddr);
  await depositTokenContract.connect(depositTokenWhaleWallet).transfer(myAddr, ethers.utils.parseEther("10000"));

  await depositSY(myWallet, depositTokenContract, ethers.utils.parseEther("10000"), false);

  console.log("----------Redeem 3000 shares to each deposit token, wombat lp token from SY--------------");
  await redeemSY(myWallet, depositTokenContract, ethers.utils.parseEther("3000"));
  await redeemSY(myWallet, lpTokenContract, ethers.utils.parseEther("3000"));

  console.log("----------Deposit deposit token and wombat lp token on SY--------------");
  await depositSY(myWallet, depositTokenContract, ethers.utils.parseEther("500"), false);
  await depositSY(myWallet, lpTokenContract, ethers.utils.parseEther("500"), false);
  console.log("exchange rate:", await magpieSYContract.exchangeRate());

  console.log("--------------rewards claim on SY----------------");
  const rewardTokens = await magpieSYContract.getRewardTokens();
  console.log("reward tokens:", rewardTokens);

  // console.log("before claim");
  // console.log("my PNP balance:", await PNPContract.balanceOf(myAddr));
  // console.log("my Pendle balance:", await depositTokenContract.balanceOf(myAddr));
  // await magpieSYContract.claimRewards(myAddr);
  // console.log("after claim");
  // console.log("my PNP balance:", await PNPContract.balanceOf(myAddr));
  // console.log("my Pendle balance:", await pendleContract.balanceOf(myAddr));
  // console.log('exchange rate:', await magpieSYContract.exchangeRate());

  console.log("---------------Other functions of SY---------------");
  console.log("Asset Info:", await magpieSYContract.connect(myWallet).assetInfo());
  console.log("Tokens In:", await magpieSYContract.connect(myWallet).getTokensIn());
  console.log("Tokens Out: ", await magpieSYContract.connect(myWallet).getTokensOut());
  console.log("check if deposit token is valid token in:", await magpieSYContract.connect(myWallet).isValidTokenIn(_depositToken));
  console.log("check if wombat lp token is valid token in:", await magpieSYContract.connect(myWallet).isValidTokenIn(_lpToken));
  console.log("check if deposit token is valid token out:", await magpieSYContract.connect(myWallet).isValidTokenOut(_depositToken));
  console.log("check if wombat lp token is valid token out:", await magpieSYContract.connect(myWallet).isValidTokenOut(_lpToken));

  console.log("--------------Some edge cases:----------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
