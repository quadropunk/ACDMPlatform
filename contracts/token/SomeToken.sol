// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SomeToken is ERC20 {
    constructor() ERC20("SomeToken", "SMT") {}
}