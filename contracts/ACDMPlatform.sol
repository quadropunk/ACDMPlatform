// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "./token/ACDMToken.sol";

contract ACDMPlatform {
    enum Rounds { Sale, Trade }

    uint256 public constant TOKEN_PRICE = 0.00001 ether;

    ACDMToken public immutable token;

    Rounds public round;

    constructor(address _token) {
        token = ACDMToken(_token);
        round = Rounds.Sale;
    }

    modifier normalPrice() {
        require(msg.value / TOKEN_PRICE != 0, "ACDMPlatform: Not enough eth to buy");
        require(msg.value % TOKEN_PRICE == 0, "ACDMPlatform: Enter exact price to not lose extra eth");
        _;        
    }

    function sale() external payable normalPrice {
        require(round == Rounds.Sale, "ACDMPlatform: Sale round is not started yet");
        payable(address(this)).transfer(msg.value);
        token.transferFrom(msg.sender, address(this), msg.value / TOKEN_PRICE);
    }

    function trade(address _seller) external payable normalPrice {
        require(round == Rounds.Trade, "ACDMPlatform: Trade round is not started yet");
        payable(_seller).transfer(msg.value);
        token.transferFrom(_seller, msg.sender, msg.value / TOKEN_PRICE);
    }

    function changeRound() external {
        if (round == Rounds.Sale)
            round = Rounds.Trade;
        else if (round == Rounds.Trade)
            round = Rounds.Sale;
    }
}