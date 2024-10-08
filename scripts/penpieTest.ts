import hre from "hardhat";
// import @nomiclabs/hardhat-ethers
import { ethers, network } from "hardhat";
import masterPenpieABI from "./ABI/masterPenpieABI.json";
import pendleStakingABI from "./ABI/pendleStaking.json";
import smartConvertABI from "./ABI/smartConvertABI.json";
import wombatRouterABI from "./ABI/wombatRouterABI.json";
import { ERC20, ERC20__factory, MPendleSY } from "../typechain-types";
import { Wallet } from "ethers";
import { JsonRpcSigner } from "@ethersproject/providers";
// import { ether } from '@utils/common';
import { BigNumber } from "ethers";

// Arguments needed for PendlePenpieSY constructor
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
let penpieSY: MPendleSY;
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
let pendleWhaleAddr = "0xdbaeB7f0DFe3a0AAFD798CCECB5b22E708f7852c";
let pendleWhaleWallet: JsonRpcSigner;
let admin, player1, player2;

const init = async () => {
  // console.log(ethers)
  wombatRouterContract = await ethers.getContractAt(wombatRouterABI, _wombatRouter);
  console.log("here");
  
  [admin, player1, player2] = await ethers.getSigners();

  console.log(player1.address,player2.address, admin.address);
  console.log(pendleWhaleAddr);
  
  
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
  console.log("Initialized !");
  
};

const deploy = async () => {
  let PenpieSY: any = await ethers.getContractFactory("MPendleSY");
  penpieSY = await PenpieSY.deploy(_name, _symbol, _pendle, _mPendle, _PNP, _mPendleRecieptToken, _smartPendleConvertor, _mPendlePenpieRewarder);

  await penpieSY.deployed();
  console.log("PenpieSY deployed to:", penpieSY.address);
  penpieSYContract = await ethers.getContractAt("MPendleSY", penpieSY.address);
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

  if (batchHarvestBeforeDeposit) await pendleStakingContract.harvestMarketReward("0x14FbC760eFaF36781cB0eb3Cb255aD976117B9Bd");

  await fromToken.connect(account).approve(penpieSYContract.address, amount);
  console.log(`expected shares to recieve ${await penpieSYContract.previewDeposit(fromToken.address, amount)} from depsit with ${await fromToken.symbol()}`);

  await penpieSYContract.connect(account).deposit(await account.getAddress(), fromToken.address, amount, 0);
  stakedAmt = (await masterPenpieContract.stakingInfo(_mPendle, penpieSYContract.address)).stakedAmount;
  console.log("Amount of mpendle staked in SY after deposit:", stakedAmt);

  console.log(`Shares recieved by user: ${(await penpieSYContract.balanceOf(await account.getAddress())).sub(beforeShares)} - shares`);
};

const redeemSY = async (account: JsonRpcSigner, targetToken: ERC20, shareAmount: BigNumber) => {
  console.log("======== redeem SY ========");
  let beforeShares = await penpieSYContract.balanceOf(await account.getAddress());
  let targetBefore = await targetToken.balanceOf(await account.getAddress());

  console.log(`preview redeemTo ${await targetToken.symbol()}: ${await penpieSYContract.previewRedeem(targetToken.address, shareAmount)}`);
  await penpieSYContract.connect(account).redeem(await account.getAddress(), shareAmount, targetToken.address, 0, false);
  console.log(`Shares burn: ${beforeShares.sub(await penpieSYContract.balanceOf(await account.getAddress()))}`);
  console.log(`${await targetToken.symbol()} Received: ${(await targetToken.balanceOf(await account.getAddress())).sub(targetBefore)}`);
};

const depositTwoTokens = async (account: JsonRpcSigner, token1: ERC20, token2: ERC20, amount1: BigNumber, amount2: BigNumber, harvest: boolean, changeRatio: boolean) => {
  await depositSY(account, token1, amount1, false);
  if (harvest) await pendleStakingContract.harvestMarketReward("0x14FbC760eFaF36781cB0eb3Cb255aD976117B9Bd");
  if (changeRatio) await swapWombatPendlePool(pendleWhaleWallet, pendleContract, [_pendle, _mPendle], ethers.utils.parseEther("5000"));
  await depositSY(account, token2, amount2, false);
};

const depositCombinations = async (account: JsonRpcSigner, token1: ERC20, token2: ERC20, amount1: BigNumber, amount2: BigNumber) => {
  console.log(`Deposit ${await token1.symbol()}, Change mPendle Ratio, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, ethers.utils.parseEther("10000"), ethers.utils.parseEther("10000"), false, true);
  console.log(`Deposit ${await token1.symbol()}, harvest, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, ethers.utils.parseEther("10000"), ethers.utils.parseEther("10000"), true, false);
  console.log(`Deposit ${await token1.symbol()}, harvest, Change mPendle Ratio, Deposit ${await token2.symbol()}`);
  await depositTwoTokens(account, token1, token2, ethers.utils.parseEther("10000"), ethers.utils.parseEther("10000"), true, true);
};

const redeemCombinations = async (account: JsonRpcSigner) => {
  console.log("------------------->Redeem mPendle->mPendleReciept->Pendle");
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));

  console.log("------------------->Redeem mPendle->Pendle->mPendleReciept");
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));

  console.log("------------------->Redeem Pendle->mPendle->mPendleReciept");
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));

  console.log("------------------->Redeem mPendleReciept->mPendle->Pendle");
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));

  console.log("------------------->Redeem mPendleReciept->Pendle->mPendle");
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));

  console.log("------------------->Redeem Pendle->mPendleReciept->mPendle");
  await redeemSY(account, pendleContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleRecieptContract, ethers.utils.parseEther("2500"));
  await redeemSY(account, mPendleContract, ethers.utils.parseEther("2500"));

  console.log("Redeem to 0");
  let sharesOwned = await penpieSYContract.balanceOf(account.getAddress());
  await redeemSY(account, mPendleRecieptContract, sharesOwned);
  sharesOwned = await penpieSYContract.balanceOf(account.getAddress());
  console.log("shares Owned=", sharesOwned);
};

const redeemSharesMoreThanBalance = async (account: JsonRpcSigner,token:ERC20) => {
  let sharesOwned = await penpieSYContract.balanceOf(account.getAddress());
  if (sharesOwned.isZero()) sharesOwned=ethers.utils.parseEther("1");
  const sharesToredeem = sharesOwned.mul(110).div(100);
  try{
    await redeemSY(account, mPendleRecieptContract, sharesToredeem);
  }catch(error){
    console.log("Unable to redeem with 0 balance");
    console.log("Error:",error);
  }
}


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
  await pendleContract.connect(pendleWhaleWallet).transfer(myAddr, ethers.utils.parseEther("100000"));

  await depositSY(myWallet, pendleContract, ethers.utils.parseEther("10000"), false);
  // await swapWombatPendlePool(pendleWhaleWallet, pendleContract, [_pendle, _mPendle], ethers.utils.parseEther("100000"));

  console.log("----------Redeem 20000 shares to each mPendle, Pendle and mPendleRecieptToken from SY--------------");
  await redeemSY(myWallet, mPendleContract, ethers.utils.parseEther("3000"));
  await redeemSY(myWallet, pendleContract, ethers.utils.parseEther("3000"));
  await redeemSY(myWallet, mPendleRecieptContract, ethers.utils.parseEther("3000"));

  console.log("----------Deposit mPendle and mPendleRecieptToken on SY--------------");
  await depositSY(myWallet, mPendleContract, ethers.utils.parseEther("500"), false);
  await depositSY(myWallet, mPendleRecieptContract, ethers.utils.parseEther("500"), false);
  console.log("exchange rate:", await penpieSYContract.exchangeRate());
  
  console.log("--------------rewards claim on SY----------------");
  const rewardTokens= await penpieSYContract.getRewardTokens();
  console.log("reward tokens:", rewardTokens);
  
  console.log("before claim");
  console.log("my PNP balance:", await PNPContract.balanceOf(myAddr));
  console.log("my Pendle balance:", await pendleContract.balanceOf(myAddr));
  let secToMove = 86400 *2;
  await network.provider.send("evm_increaseTime", [secToMove]);      
  await network.provider.send("evm_mine", []);
  console.log("secToMove: ", secToMove);
  await penpieSYContract.claimRewards(myAddr);
  console.log("after claim");
  console.log("my PNP balance:", await PNPContract.balanceOf(myAddr));
  console.log("my Pendle balance:", await pendleContract.balanceOf(myAddr));
  console.log('exchange rate:', await penpieSYContract.exchangeRate());
  

  console.log("---------------Other functions of SY---------------");
  console.log("Asset Info:", await penpieSYContract.connect(myWallet).assetInfo());
  console.log("Tokens In:", await penpieSYContract.connect(myWallet).getTokensIn());
  console.log("Tokens Out: ", await penpieSYContract.connect(myWallet).getTokensOut());
  console.log("check if mPendle is valid token in:", await penpieSYContract.connect(myWallet).isValidTokenIn(_mPendle));
  console.log("check if pendle is valid token in:", await penpieSYContract.connect(myWallet).isValidTokenIn(_pendle));
  console.log("check if mPendleRecieptToken is valid token in:", await penpieSYContract.connect(myWallet).isValidTokenIn(_mPendleRecieptToken));
  console.log("check if mPendle is valid token out:", await penpieSYContract.connect(myWallet).isValidTokenOut(_mPendle));
  console.log("check if pendle is valid token out:", await penpieSYContract.connect(myWallet).isValidTokenOut(_pendle));
  console.log("check if mPendleRecieptToken is valid token out:", await penpieSYContract.connect(myWallet).isValidTokenOut(_mPendleRecieptToken));

  console.log("--------------Some edge cases:----------------");

  console.log("Redeem to 0");
  let sharesOwned = await penpieSYContract.balanceOf(myWallet.getAddress());
  await redeemSY(myWallet, pendleContract, sharesOwned);
  console.log("check if rewards can be claimed after all shares have been redeemed.");
  console.log("my PNP balance before claim:", await PNPContract.balanceOf(myAddr));
  console.log("my PNP balance after claim:", await PNPContract.balanceOf(myAddr));
  // console.log('exchange rate:', await penpieSYContract.exchangeRate());

  // try to redeem shares when SY shares balance is 0
  console.log("redeem shares when SY shares balance is 0");
  
  await redeemSharesMoreThanBalance(myWallet, pendleContract);
  await redeemSharesMoreThanBalance(myWallet, mPendleContract);
  await redeemSharesMoreThanBalance(myWallet, mPendleRecieptContract);

  // try to redeem more shares than balance
  console.log("redeem more shares than balance");
  await depositSY(myWallet, pendleContract, ethers.utils.parseEther("100"), true);
  sharesOwned = await penpieSYContract.balanceOf(myWallet.getAddress());

  await redeemSharesMoreThanBalance(myWallet, pendleContract);
  await redeemSharesMoreThanBalance(myWallet, mPendleContract);
  await redeemSharesMoreThanBalance(myWallet, mPendleRecieptContract);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });