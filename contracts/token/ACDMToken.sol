// SPDX-License-Identifier: No-License
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract ACDMToken is ERC20 {
    constructor() ERC20("ACDMToken", "ACDM") {}

    function decimals() public view virtual override returns(uint8) {
        return 6;
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }
}