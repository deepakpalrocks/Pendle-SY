import hre from "hardhat";
import { ethers, network } from "hardhat";
import masterPenpieABI from "./ABI/masterPenpieABI.json";
import pendleStakingABI from "./ABI/pendleStaking.json";
import smartConvertABI from "./ABI/smartConvertABI.json";
import wombatRouterABI from "./ABI/wombatRouterABI.json";
import { ERC20, ERC20__factory, PenpieSY } from "../typechain-types";
import { Wallet } from "ethers";
import { JsonRpcSigner } from "@ethersproject/providers";
// import { ether } from '@utils/common';
import { BigNumber } from "ethers";

// Arguments needed for PenpieSY constructor
const _name = "mPendle";
const _symbol = "mPendle";
const _pendle = "0x0c880f6761F1af8d9Aa9C466984b80DAb9a8c9e8";
const _mPendle = "0xB688BA096b7Bb75d7841e47163Cd12D18B36A5bF";
const _PNP = "0x2Ac2B254Bc18cD4999f64773a966E4f4869c34Ee";
const _mPendleRecieptToken = "0x2b5FA2C7cb4b0F51EA7250f66Ca3eD369253ADdF";
const _pendleAsset = "0xb4bEb0fDf0163a39D39b175942E7973da2c336Fb";
const _smartPendleConvertor = "0xa9DD725bA2eaaCdb7a30d17597B7D8C3FD2F80Ed";
const _masterPenpie = "0x0776C06907CE6Ff3d9Dbf84bA9B3422d7225942D";
const _wombatRouter = "0xc4B2F992496376C6127e73F1211450322E580668";
const _mPendleWombatPool = "0xe7159f15e7b1d6045506B228A1ed2136dcc56F48";
const _mPendlePenpieRewarder = "0xbfd07Ec4130156771d4CA724116c61582548dC4A";
const mPendleOFTAddress = "0xb688ba096b7bb75d7841e47163cd12d18b36a5bf";
const pendleStaking = "0x6DB96BBEB081d2a85E0954C252f2c1dC108b3f81";

// globale contract uilities
let penpieSY: PenpieSY;
let wombatRouterContract: any;
let masterPenpieContract: any;
let pendleStakingContract: any;
let penpieSYContract: any;

let pendleContract: any;
let mPendleContract: any;
let PNPContract: any;
let mPendleRecieptContract: any;
let smartConvertContract: any;

// impersonate addresses
let pendleWhaleAddr = "0xea225b726b5118e8e1f36309811c57a7a5cfd572";
let pendleWhaleWallet: JsonRpcSigner;
let admin, player1, player2;

let allExpectationsMet = true;

const nearlyEqual = (value1: BigNumber, value2: BigNumber) => {
  let diff = BigNumber.from("0");
  if (value1.gt(value2)) diff = value1.sub(value2);
  if (value1.lt(value2)) diff = value2.sub(value1);
  diff = diff.mul(10000);
  diff = diff.div(value2);
  if (diff.gt(1)) return false;
  return true;
};
const init = async () => {
  wombatRouterContract = await ethers.getContractAt(wombatRouterABI, _wombatRouter);

  [admin, player1, player2] = await ethers.getSigners();

  await player1.sendTransaction({ to: pendleWhaleAddr, value: ethers.utils.parseEther("100") });

  await network.provider.request({
    method: "hardhat_impersonateAccount",
    params: [pendleWhaleAddr],
  });

  pendleWhaleWallet = ethers.provider.getSigner(pendleWhaleAddr);
  masterPenpieContract = new ethers.Contract(_masterPenpie, masterPenpieABI, player1);
  pendleStakingContract = new ethers.Contract(pendleStaking, pendleStakingABI, player1);
  smartConvertContract = new ethers.Contract(_smartPendleConvertor, smartConvertABI, player1);

  pendleContract = await ERC20__factory.connect(_pendle, pendleWhaleWallet);
  mPendleContract = await ERC20__factory.connect(_mPendle, pendleWhaleWallet);
  PNPContract = await ERC20__factory.connect(_PNP, pendleWhaleWallet);
  mPendleRecieptContract = await ERC20__factory.connect(_mPendleRecieptToken, pendleWhaleWallet);
};

const deploy = async () => {
  let PenpieSY: any = await ethers.getContractFactory("PenpieSY");
  penpieSY = await PenpieSY.deploy(_name, _symbol, _pendle, _mPendle, _PNP, _mPendleRecieptToken, _smartPendleConvertor, _mPendlePenpieRewarder);

  await penpieSY.deployed();
  console.log("PenpieSY deployed to:", penpieSY.address);
  penpieSYContract = await ethers.getContractAt("PendlePenpieSY", penpieSY.address);
};

const swapWombatPendlePool = async (account: JsonRpcSigner, inToken: ERC20, path: string[], amountIn: BigNumber) => {
  console.log(`======= swap path: ${path} ==========`);
  console.log("Before mPendle -> Pendle ratio: ", await smartConvertContract.currentRatio());
  await inToken.connect(account).approve(wombatRouterContract.address, amountIn);
  await wombatRouterContract.connect(account).swapExactTokensForTokens(path, [_mPendleWombatPool], amountIn, 0, await account.getAddress(), Date.now() * 2);
  console.log("New mPendle -> Pendle ratio: ", await smartConvertContract.currentRatio());
};

const depositSY = async (account: JsonRpcSigner, fromToken: ERC20, amount: BigNumber, batchHarvestBeforeDeposit: boolean) => {
  console.log("======== deposit SY ========");
  let stakedAmt = (await masterPenpieContract.stakingInfo(_mPendle, penpieSYContract.address)).stakedAmount;
  let beforeShares = await penpieSYContract.balanceOf(await account.getAddress());
  console.log("Amount of mPendle staked in SY before deposit:", stakedAmt);

  if (batchHarvestBeforeDeposit) await pendleStakingContract.harvestMarketReward("0x7D49E5Adc0EAAD9C027857767638613253eF125f");

  await fromToken.connect(account).approve(penpieSYContract.address, amount);
  const expected = await penpieSYContract.previewDeposit(fromToken.address, amount);
  console.log(`expected shares to recieve ${expected} from depsit with ${await fromToken.symbol()}`);

  await penpieSYContract.connect(account).deposit(await account.getAddress(), fromToken.address, amount, 0);
  stakedAmt = (await masterPenpieContract.stakingInfo(_mPendle, penpieSYContract.address)).stakedAmount;
  console.log("Amount of mpendle staked in SY after deposit:", stakedAmt);
  const actual = (await penpieSYContract.balanceOf(await account.getAddress())).sub(beforeShares);
  console.log(`Shares recieved by user: ${actual} - shares`);

  allExpectationsMet = allExpectationsMet && nearlyEqual(actual, expected);
};

const redeemSY = async (account: JsonRpcSigner, targetToken: ERC20, shareAmount: BigNumber) => {
  console.log("======== redeem SY ========");
  let beforeShares = await penpieSYContract.balanceOf(await account.getAddress());
  let targetBefore = await targetToken.balanceOf(await account.getAddress());
  const expected = await penpieSYContract.previewRedeem(targetToken.address, shareAmount);
  console.log(`preview redeemTo ${await targetToken.symbol()}: ${expected}`);
  await penpieSYContract.connect(account).redeem(await account.getAddress(), shareAmount, targetToken.address, 0, false);
  console.log(`Shares burn: ${beforeShares.sub(await penpieSYContract.balanceOf(await account.getAddress()))}`);

  const actual = (await targetToken.balanceOf(await account.getAddress())).sub(targetBefore);
  console.log(`${await targetToken.symbol()} Received: ${actual}`);

  allExpectationsMet = allExpectationsMet && nearlyEqual(actual, expected);
};

const depositTwoTokens = async (account: JsonRpcSigner, token1: ERC20, token2: ERC20, amount1: BigNumber, amount2: BigNumber, harvest: boolean, changeRatio: boolean) => {
  await depositSY(account, token1, amount1, false);
  if (harvest) await pendleStakingContract.harvestMarketReward("0x7D49E5Adc0EAAD9C027857767638613253eF125f");
  if (changeRatio) await swapWombatPendlePool(pendleWhaleWallet, pendleContract, [_pendle, _mPendle], ethers.utils.parseEther("500"));
  await depositSY(account, token2, amount2, false);
};

const depositCombinations = async (account: JsonRpcSigner, token1: ERC20, token2: ERC20, amount1: BigNumber, amount2: BigNumber) => {
  console.log(`Deposit ${await token1.symbol()}, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, amount1, amount2, false, false);
  console.log(`Deposit ${await token1.symbol()}, Change mPendle Ratio, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, amount1, amount2, false, true);
  console.log(`Deposit ${await token1.symbol()}, harvest, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, amount1, amount2, true, false);
  console.log(`Deposit ${await token1.symbol()}, harvest, Change mPendle Ratio, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, amount1, amount2, true, true);
};

const redeemAllShares = async (account: JsonRpcSigner) => {
  console.log("Redeem to 0");
  let sharesOwned = await penpieSYContract.balanceOf(account.getAddress());
  await redeemSY(account, mPendleRecieptContract, sharesOwned);
  sharesOwned = await penpieSYContract.balanceOf(account.getAddress());
  console.log("shares Owned=", sharesOwned);
};

const claimRewards = async (account: JsonRpcSigner) => {
  await pendleStakingContract.harvestMarketReward("0x7D49E5Adc0EAAD9C027857767638613253eF125f");
  let PNPBeforeClaim = await PNPContract.balanceOf(account.getAddress());
  await penpieSYContract.claimRewards(account.getAddress());
  const actual = (await PNPContract.balanceOf(account.getAddress())).sub(PNPBeforeClaim);
  console.log("Rewards Recieved: ", actual);
};

const redeemCombinations = async (account: JsonRpcSigner, claim: boolean, redeemToZero: boolean) => {
  await pendleStakingContract.harvestMarketReward("0x7D49E5Adc0EAAD9C027857767638613253eF125f");

  console.log("------------------->Redeem mPendle->mPendleReciept->Pendle");
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));

  console.log("------------------->Redeem mPendle->Pendle->mPendleReciept");
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));

  console.log("------------------->Redeem Pendle->mPendle->mPendleReciept");
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));

  console.log("------------------->Redeem mPendleReciept->mPendle->Pendle");
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));

  console.log("------------------->Redeem mPendleReciept->Pendle->mPendle");
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));

  console.log("------------------->Redeem Pendle->mPendleReciept->mPendle");
  await redeemSY(account, pendleContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("50"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("50"));

  if (claim) await claimRewards(account);
  if (redeemToZero) await redeemAllShares(account);
};

const redeemClaimCombinations = async (account: JsonRpcSigner) => {
  await redeemCombinations(account, false, false);
  await redeemCombinations(account, true, false);
  await redeemCombinations(account, true, true);
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

  console.log("--------------combinations of deposit, redeem and claim:----------------");
  // combinations of Deposit & Redeem:
  await pendleContract.connect(pendleWhaleWallet).transfer(myAddr, ethers.utils.parseEther("100000"));
  await swapWombatPendlePool(myWallet, pendleContract, [_pendle, _mPendle], ethers.utils.parseEther("30000"));
  await depositSY(myWallet, pendleContract, ethers.utils.parseEther("30000"), true);
  let SYbal = await penpieSYContract.balanceOf(myAddr);
  await redeemSY(myWallet, mPendleRecieptContract, SYbal);

  console.log("--------------->Pendle -> mPendle");
  await depositCombinations(myWallet, pendleContract, mPendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendle->Pendle");
  await depositCombinations(myWallet, mPendleContract, pendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendle->mPendleRecieptToken");
  await depositCombinations(myWallet, mPendleContract, mPendleRecieptContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendleRecieptToken->Pendle");
  await depositCombinations(myWallet, mPendleRecieptContract, pendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendleRecieptToken->mPendle");
  await depositCombinations(myWallet, mPendleRecieptContract, mPendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->Pendle->mPendleRecieptToken");
  await depositCombinations(myWallet, pendleContract, mPendleRecieptContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->Pendle->Pendle");
  await depositCombinations(myWallet, pendleContract, pendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendle->mPendle");
  await depositCombinations(myWallet, mPendleContract, mPendleContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);
  console.log("--------------->mPendleRecieptToken->mPendleRecieptToken");
  await depositCombinations(myWallet, mPendleRecieptContract, mPendleRecieptContract, ethers.utils.parseEther("1000"), ethers.utils.parseEther("1000"));
  await redeemClaimCombinations(myWallet);

  console.log("Final Verdict---");
  if (allExpectationsMet) console.log("All Deposits, redeems and claims actual values near to preview value, difference less than 0.01%");
  else console.log("Not all Deposits, redeems and claims near to expected");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
