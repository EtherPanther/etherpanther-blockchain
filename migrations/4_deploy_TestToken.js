const Web3 = require('web3');

var web3 = new Web3(Web3.givenProvider || "ws://localhost:8545");

var SafeMath = artifacts.require("./SafeMath.sol");
var TestToken = artifacts.require("./TestToken.sol");

module.exports = function(deployer) {
    deployer.link(SafeMath, TestToken);
    // 18 chosen as the most popular one; here also used together with toWei() from web3 to specify totalSupply
    deployer.deploy(TestToken, 'TestToken1', 'TT1', 18, web3.toBigNumber(web3.toWei('1000', 'ether')).toString());
};
