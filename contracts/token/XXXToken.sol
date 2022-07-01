// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract XXXToken is ERC20 {
    constructor() ERC20("XXXToken", "XTN") {}

    function mint(address _to, uint256 _amount) external {
        _mint(_to, _amount);
    }
}