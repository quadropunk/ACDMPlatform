// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ACDMToken is ERC20 {
    constructor() ERC20("ACDMToken", "ACDM") {
        _mint(msg.sender, 10e20);
    }
}