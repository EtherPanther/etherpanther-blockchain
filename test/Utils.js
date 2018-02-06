const Utils = {};

Utils.signMessage = function signMessage(web3, user, msg) {

    const msgHex = web3.toHex(msg);

    let signature = web3.eth.sign(user, msgHex);

    signature = signature.substr(2);
    const r = '0x' + signature.slice(0, 64);
    const s = '0x' + signature.slice(64, 128);
    const v = '0x' + signature.slice(128, 130);
    let v_decimal = web3.toDecimal(v);
    if (v_decimal < 27) {
        v_decimal += 27;
    }

    const msgWithEthPrefix = `\x19Ethereum Signed Message:\n${msg.length}${msg}`;
    const sha3Hash = web3.sha3(msgWithEthPrefix);

    return {
        hash: sha3Hash,
        v: v_decimal,
        r: r,
        s
    };

};

module.exports = Utils;
