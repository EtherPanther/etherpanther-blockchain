'use strict';

const Utils = require('../Utils.js');

const TestToken = artifacts.require("TestToken.sol");
const EtherPanther = artifacts.require("EtherPanther.sol");

const EP = require('../EPTest');


contract('EtherPanther[referrers]', function(accounts) {

    let etherPanther;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
    });

    it('should set referrer', async function () {
        // 1. None of the users has done any transactions, especially USER_1
        const transactionDoneUser1 = await etherPanther.firstValidTransactionDone(accounts[EP.Accounts.USER_1]);
        assert.isNotOk(transactionDoneUser1);

        // 2. That's why USER_1 cannot be set as a referrer
        await etherPanther.setReferrer(accounts[EP.Accounts.USER_1], {from: accounts[EP.Accounts.USER_2]});
        let referrer = await etherPanther.referrers(accounts[EP.Accounts.USER_2]);
        assert.equal(referrer, EP.ZERO_ADDRESS);

        // 3. USER_2 has already made his first transaction.
        const transactionDoneUser2 = await etherPanther.firstValidTransactionDone(accounts[EP.Accounts.USER_2]);
        assert.isOk(transactionDoneUser2);

        // 4. USER_4 does such transaction too
        //    Thanks to this both USER_2 and USER_4 can be set as the referrers later on
        await etherPanther.setReferrer(accounts[EP.Accounts.USER_1], {from: accounts[EP.Accounts.USER_4]});
        const transactionDoneUser4 = await etherPanther.firstValidTransactionDone(accounts[EP.Accounts.USER_4]);
        assert.isOk(transactionDoneUser4);

        // 5. USER_2 can be now set as the referrer becasue has already done a valid transaction
        const result = await etherPanther.setReferrer(accounts[EP.Accounts.USER_2], {from: accounts[EP.Accounts.USER_3]});
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_3]);
        assert.equal(result.logs[0].args.referrer, accounts[EP.Accounts.USER_2]);
        referrer = await etherPanther.referrers(accounts[EP.Accounts.USER_3]);
        assert.equal(accounts[EP.Accounts.USER_2], referrer);

        // 6. USER_2 cannot change his referrer - the referrer can be set during the first valid transaction only
        await etherPanther.setReferrer(accounts[EP.Accounts.USER_4], {from: accounts[EP.Accounts.USER_3]});
        referrer = await etherPanther.referrers(accounts[EP.Accounts.USER_3]);
        assert.equal(accounts[EP.Accounts.USER_2], referrer);
    });

});

contract('EtherPanther[fee transfer]', function(accounts) {

    function wei(amount) {
        return web3.toWei(amount, 'wei');
    }

    const FEES = [
        {fee: wei(0), admin: wei(0), user: wei(0)},
        {fee: wei(1), admin: wei(1), user: wei(0)},
        {fee: wei(2), admin: wei(1), user: wei(1)},
        {fee: wei(3), admin: wei(2), user: wei(1)},
        {fee: wei(4), admin: wei(2), user: wei(2)},
        {fee: web3.toBigNumber(web3.toWei('1', 'ether')).plus(1).toString(),
            admin: web3.toBigNumber(web3.toWei('0.5', 'ether')).plus(1).toString(),
            user: web3.toBigNumber(web3.toWei('0.5', 'ether')).toString()}
    ];

    let etherPanther;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});

        // USER_1 sets USER_2 as his referrer
        await etherPanther.setReferrer(accounts[EP.Accounts.USER_3], {from: accounts[EP.Accounts.USER_2]});
        await etherPanther.setReferrer(accounts[EP.Accounts.USER_2], {from: accounts[EP.Accounts.USER_1]});
        const referrer = await etherPanther.referrers(accounts[EP.Accounts.USER_1]);
        assert.equal(referrer, accounts[EP.Accounts.USER_2]);
    });

    FEES.forEach(function (feeItem) {
        it('should transfer admin fee (' + feeItem.fee + ' wei)', async function () {
            const result = await etherPanther.transferFees(feeItem.fee, {from: accounts[EP.Accounts.USER_4]});
            const ethAdmin = await etherPanther.eth(accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
            assert.equal(ethAdmin, feeItem.fee);
            assert.equal(result.logs[0].event, EP.Events.TransferFee);
            assert.equal(result.logs[0].args.user, accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
            assert.equal(result.logs[0].args.amount, feeItem.fee);
        });
    });

    FEES.forEach(function (feeItem) {
        it('should transfer admin and referral fee (' + feeItem.fee + ' wei)', async function () {
            const result = await etherPanther.transferFees(feeItem.fee, {from: accounts[EP.Accounts.USER_1]});

            const ethAdmin = await etherPanther.eth(accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
            const ethUser2 = await etherPanther.eth(accounts[EP.Accounts.USER_2]);

            assert.equal(ethAdmin, feeItem.admin);
            assert.equal(ethUser2, feeItem.user);

            // admin TransferFee event
            assert.equal(result.logs[0].event, EP.Events.TransferFee);
            assert.equal(result.logs[0].args.user, accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]);
            assert.equal(result.logs[0].args.amount, feeItem.admin);
            // referrer TransferFee event
            assert.equal(result.logs[1].event, EP.Events.TransferFee);
            assert.equal(result.logs[1].args.user, accounts[EP.Accounts.USER_2]);
            assert.equal(result.logs[1].args.amount, feeItem.user);
        });
    });

});

contract('EtherPanther[clear user balances]', function(accounts) {

    let etherPanther;
    let testToken;

    const maker = accounts[EP.Accounts.USER_1];
    const taker = accounts[EP.Accounts.USER_2];
    const transactionTokenAmount = 2;
    const transactionValueEth = web3.toWei('1800', 'wei');
    const fee = 5; // 0.3% * 1800

    const MAKER_ORDERS = {
        SELL_TOKENS: {orderType: EP.OrderType.SELL_TOKENS},
        BUY_TOKENS:  {orderType: EP.OrderType.BUY_TOKENS}
    };

    const MAKER_FUNDS = {
        ENOUGH_TOKENS:     {makerTokensBalanceStart: 3, makerEthBalanceStart: web3.toWei('1', 'wei')},
        NOT_ENOUGH_TOKENS: {makerTokensBalanceStart: 1, makerEthBalanceStart: web3.toWei('1', 'wei')},
        ENOUGH_ETH:        {makerTokensBalanceStart: 1, makerEthBalanceStart: web3.toWei('1801', 'wei')},
        NOT_ENOUGH_ETH:    {makerTokensBalanceStart: 1, makerEthBalanceStart: web3.toWei('1799', 'wei')},
    };

    const TAKER_FUNDS = {
        ENOUGH_ETH:                       {takerTokensBalanceStart: 1, takerEthBalanceStart: web3.toWei('1806', 'wei')},
        ENOUGH_ETH_BUT_NO_ETH_FOR_FEE:    {takerTokensBalanceStart: 1, takerEthBalanceStart: web3.toWei('1804', 'wei')},
        NOT_ENOUGH_ETH:                   {takerTokensBalanceStart: 1, takerEthBalanceStart: web3.toWei('1799', 'wei')},
        ENOUGH_TOKENS:                    {takerTokensBalanceStart: 3, takerEthBalanceStart: web3.toWei('6', 'wei')},
        ENOUGH_TOKENS_BUT_NO_ETH_FOR_FEE: {takerTokensBalanceStart: 3, takerEthBalanceStart: web3.toWei('4', 'wei')},
        NOT_ENOUGH_TOKENS:                {takerTokensBalanceStart: 1, takerEthBalanceStart: web3.toWei('1', 'wei')},
    };

    const RESULTS = {
        NO_TRANSACTION:     {transactionResult: false},
        MAKER_SELLS_TOKENS: {transactionResult: true, makerTokensBalanceEnd: 1, makerEthBalanceEnd: 1801, takerTokensBalanceEnd: 3, takerEthBalanceEnd: 1},
        MAKER_BUYS_TOKENS:  {transactionResult: true, makerTokensBalanceEnd: 3, makerEthBalanceEnd: 1,    takerTokensBalanceEnd: 1, takerEthBalanceEnd: 1},
    };

    const CLEAR_USER_BALANCES_DATA = [
        Object.assign(MAKER_ORDERS.SELL_TOKENS, MAKER_FUNDS.ENOUGH_TOKENS,     TAKER_FUNDS.ENOUGH_ETH,                       RESULTS.MAKER_SELLS_TOKENS),
        Object.assign(MAKER_ORDERS.SELL_TOKENS, MAKER_FUNDS.ENOUGH_TOKENS,     TAKER_FUNDS.ENOUGH_ETH_BUT_NO_ETH_FOR_FEE,    RESULTS.NO_TRANSACTION),
        Object.assign(MAKER_ORDERS.SELL_TOKENS, MAKER_FUNDS.ENOUGH_TOKENS,     TAKER_FUNDS.NOT_ENOUGH_ETH,                   RESULTS.NO_TRANSACTION),

        Object.assign(MAKER_ORDERS.SELL_TOKENS, MAKER_FUNDS.NOT_ENOUGH_TOKENS, TAKER_FUNDS.ENOUGH_ETH,                       RESULTS.NO_TRANSACTION),
        Object.assign(MAKER_ORDERS.SELL_TOKENS, MAKER_FUNDS.NOT_ENOUGH_TOKENS, TAKER_FUNDS.NOT_ENOUGH_ETH,                   RESULTS.NO_TRANSACTION),

        Object.assign(MAKER_ORDERS.BUY_TOKENS,  MAKER_FUNDS.ENOUGH_ETH,        TAKER_FUNDS.ENOUGH_TOKENS,                    RESULTS.MAKER_BUYS_TOKENS),
        Object.assign(MAKER_ORDERS.BUY_TOKENS,  MAKER_FUNDS.ENOUGH_ETH,        TAKER_FUNDS.ENOUGH_TOKENS_BUT_NO_ETH_FOR_FEE, RESULTS.NO_TRANSACTION),
        Object.assign(MAKER_ORDERS.BUY_TOKENS,  MAKER_FUNDS.ENOUGH_ETH,        TAKER_FUNDS.NOT_ENOUGH_TOKENS,                RESULTS.NO_TRANSACTION),

        Object.assign(MAKER_ORDERS.BUY_TOKENS,  MAKER_FUNDS.NOT_ENOUGH_ETH,    TAKER_FUNDS.ENOUGH_TOKENS,                    RESULTS.NO_TRANSACTION),
        Object.assign(MAKER_ORDERS.BUY_TOKENS,  MAKER_FUNDS.NOT_ENOUGH_ETH,    TAKER_FUNDS.NOT_ENOUGH_TOKENS,                RESULTS.NO_TRANSACTION)
    ];

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        testToken = await TestToken.new("Test Token ", "TT1", 18, 10000, {from: accounts[EP.Accounts.TEST_TOKEN_DEPLOYER_1]});
    });

    CLEAR_USER_BALANCES_DATA.forEach(function (data) {
        it('should clear balances', async function () {

            // deposit maker and taker ether to EtherPanther
            await etherPanther.depositEther({value: data.makerEthBalanceStart, from: maker});
            await etherPanther.depositEther({value: data.takerEthBalanceStart, from: taker});

            // fund maker and taker with tokens
            await testToken.transfer(maker, data.makerTokensBalanceStart, {from: accounts[EP.Accounts.TEST_TOKEN_DEPLOYER_1]});
            await testToken.transfer(taker, data.takerTokensBalanceStart, {from: accounts[EP.Accounts.TEST_TOKEN_DEPLOYER_1]});
            const makerBalance = await testToken.balanceOf(maker);
            const takerBalance = await testToken.balanceOf(taker);
            assert.equal(makerBalance, data.makerTokensBalanceStart);
            assert.equal(takerBalance, data.takerTokensBalanceStart);

            // maker and taker grant approval to EtherPanther smart contract
            await testToken.approve(etherPanther.address, data.makerTokensBalanceStart,  {from: maker});
            await testToken.approve(etherPanther.address, data.takerTokensBalanceStart,  {from: taker});

            // deposit maker and taker tokens to EtherPanther
            await etherPanther.depositTokens(testToken.address, data.makerTokensBalanceStart, {from: maker});
            await etherPanther.depositTokens(testToken.address, data.takerTokensBalanceStart, {from: taker});

            // clear balances
            if (data.transactionResult) {
                await etherPanther.clearUserBalances(maker, data.orderType, testToken.address, transactionTokenAmount,
                    transactionValueEth, fee, {from: taker});
            } else {
                try {
                    await etherPanther.clearUserBalances(maker, data.orderType, testToken.address, transactionTokenAmount,
                        transactionValueEth, fee, {from: taker});
                } catch(error) {
                    assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
                }

            }

            // check end balances
            const makerEthBalanceEnd =    await etherPanther.eth(maker);
            const makerTokensBalanceEnd = await etherPanther.tokens(testToken.address, maker);
            const takerEthBalanceEnd =    await etherPanther.eth(taker);
            const takerTokensBalanceEnd = await etherPanther.tokens(testToken.address, taker);

            if (data.transactionResult) {
                assert.equal(makerEthBalanceEnd.valueOf(),    data.makerEthBalanceEnd);
                assert.equal(makerTokensBalanceEnd.valueOf(), data.makerTokensBalanceEnd);
                assert.equal(takerEthBalanceEnd.valueOf(),    data.takerEthBalanceEnd);
                assert.equal(takerTokensBalanceEnd.valueOf(), data.takerTokensBalanceEnd);
            } else {
                assert.equal(makerEthBalanceEnd.valueOf(),    data.makerEthBalanceStart);
                assert.equal(makerTokensBalanceEnd.valueOf(), data.makerTokensBalanceStart);
                assert.equal(takerEthBalanceEnd.valueOf(),    data.takerEthBalanceStart);
                assert.equal(takerTokensBalanceEnd.valueOf(), data.takerTokensBalanceStart);
            }

        });
    });
});

contract('EtherPanther[signatures]', function(accounts) {

    const TEST_MESSAGES = [
        '',
        'a',
        'aa',
        'test message',
        'a very 73o45% long **((( test mess@gg3',
        'I really did make this message'
    ];

    TEST_MESSAGES.forEach(function (message) {
        it('should check if sha3 signature is valid (\'' + message + '\')', async function () {
            const etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
            const msgSigned = Utils.signMessage(web3, accounts[EP.Accounts.USER_1], message);

            const user = await etherPanther.recoverAddress(msgSigned.hash, msgSigned.v, msgSigned.r, msgSigned.s);
            assert.equal(user, accounts[EP.Accounts.USER_1]);

            const isValid = await etherPanther.isSignatureValid(accounts[EP.Accounts.USER_1], msgSigned.hash, msgSigned.v, msgSigned.r, msgSigned.s);
            assert.isOk(isValid);
        });
    });

});

// as web3 in version 0.20.4 lacks util functions, hashing is verified in functional tests (which use web3 1.0.0)
// contract('EtherPanther[hashes]', function(accounts) {
//     it('should check order sha3 hash', async function () {});
// });

contract('EtherPanther[expiration]', function(accounts) {

    let etherPanther;
    let currentBlockNumber;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        currentBlockNumber = await web3.eth.blockNumber;
    });

    it('should be not expired', async function () {
        const futureBlockNumber = currentBlockNumber + 10000;
        const isNotExpired = await etherPanther.isNotExpired(futureBlockNumber);
        assert.isOk(isNotExpired);
    });

    it('should be expired', async function () {
        const pastBlockNumber = currentBlockNumber - 1;
        const isNotExpired = await etherPanther.isNotExpired(pastBlockNumber);
        assert.isNotOk(isNotExpired);
    });

});

contract('EtherPanther[fill order]', function(accounts) {

    let etherPanther;
    const TEST_ORDER_HASH = web3.sha3('test order');
    const MAKER_TOKEN_AMOUNT = 10;

    beforeEach('setup contract for each test', async function() {
        etherPanther = await EtherPanther.new(EP.MARKET_TAKER_FEE, EP.REFERRAL_BONUS, {from: accounts[EP.Accounts.ETHER_PANTHER_DEPLOYER]});
        const filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), 0);
    });

    it('should fill order completely in one step', async function () {
        const result = await etherPanther.fillOrder(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH, MAKER_TOKEN_AMOUNT, MAKER_TOKEN_AMOUNT);

        // FillOrder event
        assert.equal(result.logs[0].event, EP.Events.FillOrder);
        assert.equal(result.logs[0].args.user, accounts[EP.Accounts.USER_1]);
        assert.equal(result.logs[0].args.hash, TEST_ORDER_HASH);
        assert.equal(result.logs[0].args.amount, MAKER_TOKEN_AMOUNT);

        const filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), MAKER_TOKEN_AMOUNT);
    });

    it('should fill order completely in two steps and not allow to fill more in the third one', async function () {
        const transactionTokenAmount1 = 1;
        const transactionTokenAmount2 = MAKER_TOKEN_AMOUNT - transactionTokenAmount1;

        // step 1 - allow to fill
        const result = await etherPanther.fillOrder(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH, MAKER_TOKEN_AMOUNT, transactionTokenAmount1);
        let filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), transactionTokenAmount1);

        // step 2 - allow to fill
        await etherPanther.fillOrder(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH, MAKER_TOKEN_AMOUNT, transactionTokenAmount2);
        filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), MAKER_TOKEN_AMOUNT);

        // step 3 - not allow to fill even one more
        try {
            await etherPanther.fillOrder(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH, MAKER_TOKEN_AMOUNT, 1);
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }
        filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), MAKER_TOKEN_AMOUNT);
    });

    it('should not fill order (transactionTokenAmount higher that makerTokenAmount)', async function () {
        const transactionTokenAmount = MAKER_TOKEN_AMOUNT + 1;

        try {
            await etherPanther.fillOrder(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH, MAKER_TOKEN_AMOUNT, transactionTokenAmount);
        } catch(error) {
            assert.include(error.message, EP.FAILED_TRANSACTION_ERROR);
        }

        const filled = await etherPanther.orderFills(accounts[EP.Accounts.USER_1], TEST_ORDER_HASH);
        assert.equal(filled.valueOf(), 0);
    });

});
