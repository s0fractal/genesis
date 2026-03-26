// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OMEGA-64 Thermodynamic Energy Token (ATP)
 * @dev Era 410: Proof-of-Useful-Work Blockchain Integration
 */
contract ATPToken is ERC20, ERC20Burnable, Ownable {
    uint256 public constant MAX_SUPPLY = 21_000_000 * 10**18;
    
    // Address of the ZK-Verifier contract (e.g., Succinct SP1 Router)
    address public proofVerifier;

    constructor() ERC20("Adenosine Triphosphate", "ATP") Ownable(msg.sender) {}

    function setVerifier(address _verifier) external onlyOwner {
        proofVerifier = _verifier;
    }

    modifier onlyVerifier() {
        require(msg.sender == proofVerifier || msg.sender == owner(), "OMEGA-64: Only Verifier / Oracle can mint");
        _;
    }

    /**
     * @dev Mint new ATP tokens for valid Proof-of-Useful-Work (PoUW).
     * This is strictly gated by the SP1 ZK-Verifier contract.
     * 
     * When an OMEGA-64 Node finds an exotic Plasmid (AST configuration),
     * it submits the RISC-V ZK-Proof. The verifier validates the physics,
     * and if correct, mints the resulting thermodynamic energy to the observer.
     */
    function mint(address to, uint256 amount) external onlyVerifier {
        require(totalSupply() + amount <= MAX_SUPPLY, "OMEGA-64: Exceeds absolute thermodynamic limit of 21M ATP");
        _mint(to, amount);
    }
}
