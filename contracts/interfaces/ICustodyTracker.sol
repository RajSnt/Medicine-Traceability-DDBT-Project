// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title ICustodyTracker
 * @notice Interface for tracking custody transfers across registered actors.
 */
interface ICustodyTracker {
    struct CustodyRecord {
        address from;
        address to;
        uint256 timestamp;
    }

    event CustodyTransferred(
        bytes32 indexed batchId,
        address indexed from,
        address indexed to,
        uint256 timestamp
    );

    function initializeCustody(bytes32 batchId, address manufacturer) external;
    function transferCustody(bytes32 batchId, address to) external;
    function getCustodyHistory(bytes32 batchId) external view returns (CustodyRecord[] memory);
    function getCurrentCustodian(bytes32 batchId) external view returns (address);
}
