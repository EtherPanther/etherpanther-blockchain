const fs = require('fs');
const HDWalletProvider = require('truffle-hdwallet-provider');
const mnemonic = fs.readFileSync('./config/coinbaseMnemonic', 'utf8');

module.exports = {

  networks: {
    development: {
      host: "localhost",
      port: 8545,
      network_id: 73,
      gas: 4600000
    },
    ropsten: {
      provider: function() {
          return new HDWalletProvider(mnemonic, fs.readFileSync('./config/ropstenUrl', 'utf8'));
      },
      network_id: 3,
      gas: 4600000,
    }
  }
};
