const Web3 = require('web3');

var web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

var SafeMath = artifacts.require("./SafeMath.sol");
var EtherPanther = artifacts.require("./EtherPanther.sol");

const INIT_MARKET_TAKER_FEE = web3.toBigNumber(web3.toWei('0.003', 'ether')).toString(); // 0.3 %
const INIT_REFERRAL_BONUS = web3.toBigNumber(web3.toWei('0.5', 'ether')).toString(); // 50 %

module.exports = function(deployer) {
    deployer.link(SafeMath, EtherPanther);
    deployer.deploy(EtherPanther, INIT_MARKET_TAKER_FEE, INIT_REFERRAL_BONUS);
};
