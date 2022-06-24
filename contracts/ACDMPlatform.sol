// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "./token/ACDMToken.sol";

contract ACDMPlatform {
    enum Rounds {
        Sale,
        Trade
    }

    ACDMToken public immutable token;

    Rounds public round;
    uint256 public roundTime;
    uint256 public startTime;
    uint256 public tokenPrice = 0.00001 ether;

    mapping(address => bool) public users;

    /// @dev invited => inviter
    mapping(address => address) public refers;
    /// @dev seller => tokensAmount
    mapping(address => uint256) public orderBook;

    constructor(address _token, uint256 _roundTime) {
        (token, roundTime) = (ACDMToken(_token), _roundTime);
    }

    modifier normalPrice() {
        require(
            msg.value / tokenPrice != 0,
            "ACDMPlatform: Not enough eth to buy"
        );
        require(
            msg.value % tokenPrice == 0,
            "ACDMPlatform: Enter exact price to not lose extra eth"
        );
        _;
    }

    modifier registered() {
        require(
            users[msg.sender] == true,
            "ACDMPlatform: You're not registered"
        );
        _;
    }

    modifier updateRound() {
        if (startTime + roundTime < block.timestamp) {
            if (round == Rounds.Sale) round = Rounds.Trade;
            else if (round == Rounds.Trade) round = Rounds.Sale;
            startTime = block.timestamp;
        }
        else
            revert("ACDMPlatform: Round period is not over yet");
        _;
    }

    function register() external {
        users[msg.sender] = true;
    }

    function register(address _referrer) external {
        require(
            users[_referrer] == true,
            "ACDMPlatform: Given referrer is not registered"
        );
        users[msg.sender] = true;
        refers[msg.sender] = _referrer;
    }

    function startSaleRound() external registered updateRound {
        if (startTime != 0) {
            tokenPrice = (tokenPrice * 103) / 100 + 0.000004 ether;
            require(
                round == Rounds.Trade,
                "ACDMPlatform: Sale round is already on"
            );
            require(
                startTime + roundTime < block.timestamp,
                "ACDMPlatform: Previous round is not finished yet"
            );
        }

        token.burn(address(this), token.balanceOf(address(this)));
        token.mint(address(this), address(this).balance / tokenPrice);
    }

    function buyACDM() external payable normalPrice registered updateRound {
        require(
            round == Rounds.Sale,
            "ACDMPlatform: Sale round is not started yet"
        );
        if (refers[msg.sender] != address(0)) {
            payable(refers[msg.sender]).transfer((msg.value * 5) / 100);
            if (refers[refers[msg.sender]] != address(0))
                payable(refers[refers[msg.sender]]).transfer(
                    (msg.value * 3) / 100
                );
        }
        token.transfer(msg.sender, msg.value / tokenPrice);
    }

    function startTradeRound() external registered updateRound {
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is already on"
        );
        require(
            startTime + roundTime < block.timestamp,
            "ACDMPlatform: Previos round is not finished yet"
        );
    }

    function addOrder(uint256 _amount) external registered updateRound {
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is not started yet"
        );
        token.transferFrom(msg.sender, address(this), _amount);
        orderBook[msg.sender] = _amount;
    }

    function removeOrder() external registered {
        require(
            orderBook[msg.sender] != 0,
            "ACDMPlatform: Your order is already empty!"
        );
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is not started yet"
        );
        token.transfer(msg.sender, token.balanceOf(msg.sender));
        orderBook[msg.sender] = 0;
    }

    function redeemOrder(address _from)
        external
        payable
        normalPrice
        registered
        updateRound
    {
        require(
            users[_from] == true,
            "ACDMPlatform: Given user address is not registrated"
        );
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is not started yet"
        );
        uint256 tokensAmount = msg.value / tokenPrice;
        uint256 toSend = tokensAmount;
        if (refers[msg.sender] != address(0)) {
            token.transfer(refers[msg.sender], (tokensAmount * 5) / 100);
            toSend -= (tokensAmount * 5) / 100;
            if (refers[refers[msg.sender]] != address(0)) {
                token.transfer(
                    refers[refers[msg.sender]],
                    (tokensAmount * 3) / 100
                );
                toSend -= (tokensAmount * 3) / 100;
            }
        }
        token.transfer(msg.sender, msg.value / toSend);
    }
}
