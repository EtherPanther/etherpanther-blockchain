const EP = {};

EP.MARKET_TAKER_FEE = web3.toBigNumber(web3.toWei('0.003', 'ether')).toString();
EP.MARKET_TAKER_FEE_TO0_HIGH = web3.toBigNumber(EP.MARKET_TAKER_FEE).plus(1).toString();
EP.MARKET_TAKER_FEE_DECREASED = web3.toBigNumber(EP.MARKET_TAKER_FEE).minus(1).toString();

EP.REFERRAL_BONUS = web3.toBigNumber(web3.toWei('0.5', 'ether')).toString();
EP.REFERRAL_BONUS_MAX = web3.toBigNumber(web3.toWei('1', 'ether')).toString();
EP.REFERRAL_BONUS_TOO_HIGH = web3.toBigNumber(EP.REFERRAL_BONUS_MAX).plus(1).toString();
EP.REFERRAL_BONUS_DECREASED = web3.toBigNumber(EP.REFERRAL_BONUS_MAX).minus(1).toString();

EP.FAILED_TRANSACTION_ERROR = 'VM Exception while processing transaction: revert';
EP.ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

EP.UINT256_MAX = web3.toBigNumber(2).pow(web3.toBigNumber(256)).sub(web3.toBigNumber(1));

EP.Accounts = {
    ETHER_PANTHER_DEPLOYER : 0,

    ADMIN_1 : 1,
    ADMIN_2 : 2,

    TEST_TOKEN_DEPLOYER_1 : 3,
    TEST_TOKEN_DEPLOYER_2 : 4,
    TEST_TOKEN_DEPLOYER_3 : 5,

    USER_1 : 6,
    USER_2 : 7,
    USER_3 : 8,
    USER_4 : 9
};

EP.OrderType = {
    SELL_TOKENS : 1,
    BUY_TOKENS : 2
};

EP.Events = {
    DepositEther: 'DepositEther',
    WithdrawEther: 'WithdrawEther',
    DepositTokens: 'DepositTokens',
    WithdrawTokens: 'WithdrawTokens',
    FillOrder: 'FillOrder',
    CancelOrder: 'CancelOrder',
    SetReferrer: 'SetReferrer',
    TransferFee: 'TransferFee'
};

module.exports = EP;
