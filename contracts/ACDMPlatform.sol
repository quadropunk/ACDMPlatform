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

    event Registered(address user, address referrer1, address referrer2);
    event Bought(
        address user,
        address referrer1,
        address referrer2,
        uint256 price,
        uint256 tokens
    );
    event OrderAdded(address user, uint256 amount);
    event OrderRemoved(address user, uint256 amount);
    event OrderRedeemed(address from, address to, uint256 amount);

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
        if (startTime == 0) {
            round = Rounds.Sale;
            startTime = block.timestamp;
        } else if (startTime + roundTime < block.timestamp) {
            if (round == Rounds.Sale) {
                round = Rounds.Trade;
            } else if (round == Rounds.Trade) {
                round = Rounds.Sale;
                tokenPrice = (tokenPrice * 103) / 100 + 0.000004 ether;
                token.burn(address(this), token.balanceOf(address(this)));
                token.mint(address(this), address(this).balance / tokenPrice);
            }
            startTime = block.timestamp;
        }

        _;
    }

    function register() external {
        require(
            users[msg.sender] == false,
            "ACDMPlatform: You already registered"
        );
        users[msg.sender] = true;
        emit Registered(msg.sender, address(0), address(0));
    }

    function register(address _referrer) external {
        require(
            users[msg.sender] == false,
            "ACDMPlatform: You already registered"
        );
        require(
            users[_referrer] == true,
            "ACDMPlatform: Given referrer is not registered"
        );
        users[msg.sender] = true;
        refers[msg.sender] = _referrer;
        emit Registered(msg.sender, _referrer, refers[_referrer]);
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
        emit Bought(
            msg.sender,
            refers[msg.sender],
            refers[refers[msg.sender]],
            msg.value,
            msg.value / tokenPrice
        );
    }

    function addOrder(uint256 _amount) external registered updateRound {
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is not started yet"
        );
        token.transferFrom(msg.sender, address(this), _amount);
        orderBook[msg.sender] += _amount;
        emit OrderAdded(msg.sender, _amount);
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
        token.transfer(msg.sender, orderBook[msg.sender]);
        emit OrderRemoved(msg.sender, orderBook[msg.sender]);
        delete orderBook[msg.sender];
    }

    function redeemOrder(address _from)
        external
        payable
        normalPrice
        registered
        updateRound
    {
        require(
            round == Rounds.Trade,
            "ACDMPlatform: Trade round is not started yet"
        );
        require(
            orderBook[_from] != 0,
            "ACDMPlatform: Given user does not have any order"
        );
        uint256 tokensAmount = msg.value / tokenPrice;
        require(
            tokensAmount <= orderBook[_from],
            "ACDMPlatform: Not enough tokens in the order"
        );

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
        token.transfer(msg.sender, toSend);
        emit OrderRedeemed(_from, msg.sender, orderBook[_from]);
        orderBook[_from] -= tokensAmount;
    }

    receive() external payable {}
}
