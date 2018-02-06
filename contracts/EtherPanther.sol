pragma solidity ^0.4.10;

import './SafeMath.sol';
import './ERC20Interface.sol';


contract EtherPanther {

    using SafeMath for uint;

    uint public MAX_MARKET_TAKER_FEE = 3 * 10**15; // when divided by 1ETH will give 0.3%
    uint public MAX_REFERRAL_BONUS = 1 * 10**18;  // when divided by 1ETH will give 100%

    enum OrderType {RESERVED, SELL_TOKENS, BUY_TOKENS}

    address public admin;
    uint public marketTakerFee;
    uint public referralBonus;
    mapping (address => uint) public eth;
    mapping (address => mapping (address => uint)) public tokens;
    mapping (address => mapping (bytes32 => uint)) public orderFills;

    mapping (address => bool) public firstValidTransactionDone;
    mapping (address => address) public referrers;

    event DepositEther(address user, uint amount, uint balance);
    event WithdrawEther(address user, uint amount, uint balance);
    event DepositTokens(address token, address user, uint amount, uint balance);
    event WithdrawTokens(address token, address user, uint amount, uint balance);
    event FillOrder(address user, bytes32 hash, uint amount);
    event CancelOrder(address user, bytes32 hash);
    event SetReferrer(address user, address referrer);
    event TransferFee(address user, uint amount);

    function EtherPanther(uint _marketTakerFee, uint _referralBonus) public {
        require(_marketTakerFee <= MAX_MARKET_TAKER_FEE);
        require(_referralBonus <= MAX_REFERRAL_BONUS);
        admin = msg.sender;
        marketTakerFee = _marketTakerFee;
        referralBonus = _referralBonus;
    }

    function() public {
        revert();
    }

    modifier onlyAdmin() {
        require(msg.sender == admin);
        _;
    }

    function setAdmin(address _newAdmin) public onlyAdmin {
        require(_newAdmin != address(0));
        admin = _newAdmin;
    }

    function setMarketTakerFee(uint _marketTakerFee) public onlyAdmin {
        require(_marketTakerFee <= MAX_MARKET_TAKER_FEE);
        marketTakerFee = _marketTakerFee;
    }

    function setReferralBonus(uint _referralBonus) public onlyAdmin {
        require(_referralBonus <= MAX_REFERRAL_BONUS);
        referralBonus = _referralBonus;
    }

    function depositEther() public payable {
        eth[msg.sender] = eth[msg.sender].add(msg.value);
        DepositEther(msg.sender, msg.value, eth[msg.sender]);
    }

    function withdrawEther(uint amount) public {
        require(amount <= eth[msg.sender]);
        eth[msg.sender] = eth[msg.sender].sub(amount);
        require(msg.sender.call.value(amount)());
        WithdrawEther(msg.sender, amount, eth[msg.sender]);
    }

    function depositTokens(address token, uint amount) public {
        // A user needs to grant permission first by calling ERC20Interface(token).approve(this, amount)
        require(token != address(0));
        require(ERC20Interface(token).transferFrom(msg.sender, this, amount));
        tokens[token][msg.sender] = tokens[token][msg.sender].add(amount);
        DepositTokens(token, msg.sender, amount, tokens[token][msg.sender]);
    }

    function withdrawTokens(address token, uint amount) public {
        require(token != address(0));
        require(amount <= tokens[token][msg.sender]);
        tokens[token][msg.sender] = tokens[token][msg.sender].sub(amount);
        require(ERC20Interface(token).transfer(msg.sender, amount));
        WithdrawTokens(token, msg.sender, amount, tokens[token][msg.sender]);
    }

    // as of time of writing passing structs to public functions is an experimental feature ("pragma experimental ABIEncoderV2") only;
    // all arguments have to be passed separately
    function trade(address maker,
                   OrderType orderType, address token, uint makerTokenAmount, uint makerEthAmount, uint expires, uint nonce, uint8 v, bytes32 r, bytes32 s, // maker data
                   uint transactionTokenAmount, address referrer) public { // taker data
        bytes32 hash = getHash(orderType, token, makerTokenAmount, makerEthAmount, expires, nonce);
        require(isSignatureValid(maker, hash, v, r, s));
        require(isNotExpired(expires));
        setReferrer(referrer);
        if (transactionTokenAmount > makerTokenAmount) {
            transactionTokenAmount = makerTokenAmount;
        }
        uint transactionEthAmount = makerEthAmount.mul(transactionTokenAmount).div(makerTokenAmount);
        uint fee = transactionEthAmount.mul(marketTakerFee) / (1 ether);
        clearUserBalances(maker, orderType, token, transactionTokenAmount, transactionEthAmount, fee);
        transferFees(fee);
        fillOrder(maker, hash, makerTokenAmount, transactionTokenAmount);
    }

    function cancelOrder(bytes32 hash) public {
        orderFills[msg.sender][hash] = 2**256 - 1;
        CancelOrder(msg.sender, hash);
    }

    // -----------------------------------------------------------------------------------------------------------------
    // contract's private methods
    // -----------------------------------------------------------------------------------------------------------------
    function setReferrer(address referrer) private {
        if (!firstValidTransactionDone[msg.sender] && // referrer can be set only during the first valid transaction
           firstValidTransactionDone[referrer]) { // referrer must have already done a valid transaction
            referrers[msg.sender] = referrer;
            SetReferrer(msg.sender, referrer);
        }
        firstValidTransactionDone[msg.sender] = true;
    }

    function clearUserBalances(address maker, OrderType orderType, address token, uint transactionTokenAmount, uint transactionValueEth, uint fee) private {
        if (orderType == OrderType.SELL_TOKENS) {
            tokens[token][maker] = tokens[token][maker].sub(transactionTokenAmount);
            eth[maker] = eth[maker].add(transactionValueEth);
            tokens[token][msg.sender] = tokens[token][msg.sender].add(transactionTokenAmount);
            eth[msg.sender] = eth[msg.sender].sub(transactionValueEth.add(fee));
        }  else {
            tokens[token][maker] = tokens[token][maker].add(transactionTokenAmount);
            eth[maker] = eth[maker].sub(transactionValueEth);
            tokens[token][msg.sender] = tokens[token][msg.sender].sub(transactionTokenAmount);
            eth[msg.sender] = eth[msg.sender].add(transactionValueEth.sub(fee));
        }
    }

    function transferFees(uint fee) private {
        address referrer = referrers[msg.sender];
        if (referrer != address(0)) {
            uint referralFee = fee.mul(referralBonus) / (1 ether);
            eth[referrer] = eth[referrer].add(referralFee);
            uint adminFee = fee.sub(referralFee);
            eth[admin] = eth[admin].add(fee.sub(referralFee));
            TransferFee(admin, adminFee);
            TransferFee(referrer, referralFee);
        } else {
            eth[admin] = eth[admin].add(fee);
            TransferFee(admin, fee);
        }
    }

    function isNotExpired(uint expires) private view returns (bool) {
        return block.number <= expires;
    }

    function getHash(OrderType orderType, address token, uint tokenAmount, uint makerEthAmount, uint expires, uint nonce) private view returns (bytes32) {
        // explicit conversion from OrderType to uint is required
        return keccak256(this, uint(orderType), token, tokenAmount, makerEthAmount, expires, nonce);
    }

    function isSignatureValid(address user, bytes32 hash, uint8 v, bytes32 r, bytes32 s) private pure returns (bool) {
        return recoverAddress(hash, v, r, s) == user;
    }

    function recoverAddress(bytes32 hash, uint8 v, bytes32 r, bytes32 s) private pure returns (address) {
        return ecrecover(hash, v, r, s);
    }

    function fillOrder(address maker, bytes32 hash, uint makerTokenAmount, uint transactionTokenAmount) private {
        require(orderFills[maker][hash].add(transactionTokenAmount) <= makerTokenAmount);
        orderFills[maker][hash] = orderFills[maker][hash].add(transactionTokenAmount);
        FillOrder(maker, hash, transactionTokenAmount);
    }

}
