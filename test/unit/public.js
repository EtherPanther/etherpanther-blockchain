'use strict';

const TestToken = artifacts.require("TestToken.sol");
const EtherPanther = artifacts.require("EtherPanther.sol");

const EP = require('../EPTest');


contract('EtherPanther[deployment]', function(accounts) {

    it('should create EtherPanther contract', async function() {
        const etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        const admin = await etherPanther.admin();
        assert.equal(admin, accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
    });

    it('should not create EtherPanther contract', async function() {
        let etherPanther;

        try {
            etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE_TO0_HIGH, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }

        try {
            etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS_TOO_HIGH, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
    });

});

contract('EtherPanther[administration]', function(accounts) {

    let etherPanther;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS_MAX, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
    });

    it('should set new admin', async function() {
        await etherPanther.setAdmin(accounts[EP.Accounts.ADMIN_1], {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        const newAdmin = await etherPanther.admin();
        assert.equal(newAdmin, accounts[EP.Accounts.ADMIN_1]);
    });

    it('should not set new admin', async function() {
        try {
            await etherPanther.setAdmin(accounts[EP.Accounts.ADMIN_1], {from: accounts[EP.Accounts.USER_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const admin = await etherPanther.admin();
        assert.equal(admin, accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
    });

    it('should set new marketTakerFee', async function() {
        await etherPanther.setMarketTakerFee(EP.MARKET_TAKER_FEE_DECREASED, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        const marketTakerFee = await etherPanther.marketTakerFee();
        assert.equal(marketTakerFee.valueOf(), EP.MARKET_TAKER_FEE_DECREASED);
    });

    it('should not set new marketTakerFee (not allowed)', async function() {
        try {
            await etherPanther.setMarketTakerFee(EP.MARKET_TAKER_FEE_DECREASED, {from: accounts[EP.Accounts.USER_1]});
        } catch (error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const marketTakerFee = await etherPanther.marketTakerFee();
        assert.equal(marketTakerFee.valueOf(), EP.MARKET_TAKER_FEE);
    });

    it('should not set new marketTakerFee (fee out of range)', async function() {
        try {
            await etherPanther.setMarketTakerFee(EP.MARKET_TAKER_FEE_TO0_HIGH, {from: accounts[EP.Accounts.ADMIN_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const marketTakerFee = await etherPanther.marketTakerFee();
        assert.equal(marketTakerFee.valueOf(), EP.MARKET_TAKER_FEE);
    });

    it('should set new referralBonus', async function() {
        await etherPanther.setReferralBonus(EP.REFERRAL_BONUS_DECREASED, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        const referralBonus = await etherPanther.referralBonus();
        assert.equal(referralBonus.valueOf(), EP.REFERRAL_BONUS_DECREASED);
    });

    it('should not set new referralBonus (not allowed)', async function() {
        try {
            await etherPanther.setReferralBonus(EP.REFERRAL_BONUS_DECREASED, {from: accounts[EP.Accounts.USER_1]});
        } catch (error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const referralBonus = await etherPanther.referralBonus();
        assert.equal(referralBonus.valueOf(), EP.REFERRAL_BONUS_MAX);
    });

    it('should not set new referralBonus (bonus out of range)', async function() {
        try {
            await etherPanther.setReferralBonus(EP.REFERRAL_BONUS_TOO_HIGH, {from: accounts[EP.Accounts.ADMIN_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const referralBonus = await etherPanther.referralBonus();
        assert.equal(referralBonus.valueOf(), EP.REFERRAL_BONUS_MAX);
    });

});

contract('EtherPanther[deposit/withdraw Ether]', function(accounts) {

    let etherPanther;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS , {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
    });

    it('should deposit ether to EtherPanther', async function() {
        const result = await etherPanther.depositEther({from: accounts[EP.Accounts.USER_1], value: 1234});
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.amount, 1234);
        assert.equal(result.logs[0].args.balance, 1234);
        const balance = await etherPanther.eth(accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 1234);
    });

    it('should withdraw ether from EtherPanther', async function() {
        // deposit
        await etherPanther.depositEther({from: accounts[EP.Accounts.USER_1], value: 1234});
        let balance = await etherPanther.eth(accounts[EP.Accounts.USER_1]);
        assert.equal(balance.valueOf(), 1234);

        // withdraw
        await etherPanther.withdrawEther(1230, {from: accounts[EP.Accounts.USER_1]});
        balance = await etherPanther.eth(accounts[EP.Accounts.USER_1]);
        assert.equal(balance.valueOf(), 4);
    });

    it('should not withdraw ether from EtherPanther (not enough funds)', async function() {
        try {
            await etherPanther.withdrawEther(1230, {from: accounts[EP.Accounts.USER_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const balance = await etherPanther.eth(accounts[EP.Accounts.USER_1]);
        assert.equal(balance.valueOf(), 0);
    });

    it('should emit DepositEther and WithdrawEther events', async function() {
        // deposit
        let result = await etherPanther.depositEther({from: accounts[EP.Accounts.USER_1], value: 1234});
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.amount, 1234);
        assert.equal(result.logs[0].args.balance, 1234);

        // withdraw
        result = await etherPanther.withdrawEther(1230, {from: accounts[EP.Accounts.USER_1]});
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.amount, 1230);
        assert.equal(result.logs[0].args.balance, 4);
    });

});

contract('EtherPanther[deposit/withdraw tokens]', function(accounts) {

    let etherPanther;
    let testToken;

    beforeEach('setup contracts for each test', async function() {
        etherPanther = await EtherPanther.new(accounts[EP.Accounts.ADMIN_1], EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS);
        testToken = await TestToken.new("Test Token ", "TT1", 18, 10000, {from: accounts[EP.Accounts.TEST_TOKEN_DEPLOYER_1]});

        await testToken.transfer(accounts[EP.Accounts.USER_1], 2345, {from: accounts[EP.Accounts.TEST_TOKEN_DEPLOYER_1]});
        const balance = await testToken.balanceOf(accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 2345);
    });

    it('should deposit tokens to EtherPanther', async function() {
        // deposit - user grants approval to EtherPanther smart contract
        await testToken.approve(etherPanther.address, 2345,  {from: accounts[EP.Accounts.USER_1]});

        // deposit
        await etherPanther.depositTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        const balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 2345);
    });

    it('should not deposit tokens to EtherPanther (user did not grant approval to EtherPanther smart contract)', async function() {
        // deposit
        try {
            await etherPanther.depositTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        const balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]); //
        assert.equal(balance, 0);
    });

    it('should withdraw tokens from EtherPanther', async function() {
        // deposit prerequisite: user grants approval to EtherPanther smart contract
        await testToken.approve(etherPanther.address, 2345,  {from: accounts[EP.Accounts.USER_1]});

        // deposit
        await etherPanther.depositTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        let balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 2345);

        // withdraw
        await etherPanther.withdrawTokens(testToken.address, 2340, {from: accounts[EP.Accounts.USER_1]});
        balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 5);
    });

    it('should not withdraw tokens from EtherPanther (not enough funds)', async function() {
        // deposit prerequisite: user grants approval to EtherPanther smart contract
        await testToken.approve(etherPanther.address, 2345 + 5,  {from: accounts[EP.Accounts.USER_1]});

        // deposit
        await etherPanther.depositTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        let balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 2345);

        // withdraw
        await etherPanther.withdrawTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 0);

        // withdraw
        try {
            await etherPanther.withdrawTokens(testToken.address, 5, {from: accounts[EP.Accounts.USER_1]});
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        balance = await etherPanther.tokens(testToken.address, accounts[EP.Accounts.USER_1]);
        assert.equal(balance, 0);
    });

    it('should emit DepositTokens and WithdrawTokens events', async function() {
        // deposit prerequisite: user grants approval to EtherPanther smart contract
        await testToken.approve(etherPanther.address, 2345,  {from: accounts[EP.Accounts.USER_1]});

        // deposit
        let result = await etherPanther.depositTokens(testToken.address, 2345, {from: accounts[EP.Accounts.USER_1]});
        assert.equal(result.logs[0].args.token, testToken.address);
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.amount, 2345);
        assert.equal(result.logs[0].args.balance, 2345);
        
        // withdraw
        result = await etherPanther.withdrawTokens(testToken.address, 2341, {from: accounts[EP.Accounts.USER_1]});
        assert.equal(result.logs[0].args.token, testToken.address);
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.amount, 2341);
        assert.equal(result.logs[0].args.balance, 4);
    });

});

contract('EtherPanther[cancel order]', function(accounts) {

    it('should cancel order and emit CancelOrder events', async function() {
        const etherPanther = await EtherPanther.new(accounts[EP.Accounts.ADMIN_1], EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS);
        const TEST_ORDER_HASH = 0;
        const cancel = await etherPanther.cancelOrder(TEST_ORDER_HASH, {from: accounts[EP.Accounts.USER_1]});

        assert.equal(cancel.logs[0].event, EP.Events.CancelOrder);
        assert.equal(cancel.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(cancel.logs[0].args.hash, TEST_ORDER_HASH);

        const orderFills = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(orderFills.toString(), EP.UINT256_MAX.toString());
    });

});
