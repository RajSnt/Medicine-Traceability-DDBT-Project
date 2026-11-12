// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IBatchRegistry
 * @notice Interface for registering and querying medicine batches.
 */
interface IBatchRegistry {
    struct Batch {
        bytes32 batchId;
        string medicineName;
        string batchMetadata;
        address manufacturer;
        uint256 createdAt;
        bool exists;
    }

    function registerBatch(bytes32 batchId, string calldata medicineName, string calldata batchMetadata) external;
    function batchExists(bytes32 batchId) external view returns (bool);
    function getBatch(bytes32 batchId) external view returns (Batch memory);
    function setCustodyTracker(address _custodyTracker) external;
    function custodyTracker() external view returns (address);
    function roleManager() external view returns (address);
    function admin() external view returns (address);
}
