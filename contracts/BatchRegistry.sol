// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IRoleManager.sol";
import "./interfaces/IBatchRegistry.sol";
import "./interfaces/ICustodyTracker.sol";

/**
 * @title BatchRegistry
 * @author Medicine Traceability MVP Team
 * @notice Stores immutable medicine batch records registered by authorized manufacturers.
 * @dev Integrates with RoleManager for access control and CustodyTracker for custody lifecycle.
 */
contract BatchRegistry is IBatchRegistry {
    /// @notice Custom error thrown when caller is not the system administrator.
    error OnlyAdmin(address caller);

    /// @notice Custom error thrown when a non-manufacturer attempts to register a batch.
    error UnauthorizedManufacturer(address caller);

    /// @notice Custom error thrown when attempting to register an already existing batch ID.
    error DuplicateBatch(bytes32 batchId);

    /// @notice Custom error thrown when batch ID is bytes32(0).
    error InvalidBatchId();

    /// @notice Custom error thrown when medicine name is empty string.
    error EmptyMedicineName();

    /// @notice Custom error thrown when batch registration is attempted before custody tracker is wired.
    error TrackerNotConfigured();

    /// @notice Custom error thrown when attempting to reconfigure custody tracker address.
    error TrackerAlreadyConfigured();

    /// @notice Custom error thrown when passing the zero address for a required contract.
    error InvalidAccount();

    /// @notice Emitted when a new batch is successfully registered.
    event BatchRegistered(
        bytes32 indexed batchId,
        string medicineName,
        address indexed manufacturer,
        uint256 createdAt
    );

    /// @notice Emitted when the custody tracker address is configured by the admin.
    event CustodyTrackerConfigured(address indexed trackerAddress);

    /// @notice RoleManager contract reference.
    address public immutable override roleManager;

    /// @notice System admin address retrieved from RoleManager.
    address public immutable override admin;

    /// @notice Configured CustodyTracker contract address.
    address public override custodyTracker;

    /// @dev Internal mapping of batchId to Batch metadata.
    mapping(bytes32 => Batch) private _batches;

    /// @notice Initializes the BatchRegistry with RoleManager address.
    /// @param _roleManager Address of the deployed RoleManager contract.
    constructor(address _roleManager) {
        if (_roleManager == address(0)) revert InvalidAccount();
        roleManager = _roleManager;
        admin = IRoleManager(_roleManager).admin();
    }

    /// @notice Configures the CustodyTracker contract address once.
    /// @dev Only callable once by the admin to eliminate circular constructor dependencies.
    /// @param _custodyTracker Address of the deployed CustodyTracker.
    function setCustodyTracker(address _custodyTracker) external override {
        if (msg.sender != admin) revert OnlyAdmin(msg.sender);
        if (custodyTracker != address(0)) revert TrackerAlreadyConfigured();
        if (_custodyTracker == address(0)) revert InvalidAccount();

        custodyTracker = _custodyTracker;
        emit CustodyTrackerConfigured(_custodyTracker);
    }

    /// @notice Registers a new medicine batch and initializes its custody.
    /// @dev Callable only by accounts holding Role.Manufacturer. Requires configured tracker.
    /// @param batchId Unique 32-byte hash identifying the batch (e.g. ethers.id("BATCH-001")).
    /// @param medicineName Name of the pharmaceutical product.
    /// @param batchMetadata Minimal batch metadata (e.g. dosage, packaging details).
    function registerBatch(
        bytes32 batchId,
        string calldata medicineName,
        string calldata batchMetadata
    ) external override {
        if (custodyTracker == address(0)) {
            revert TrackerNotConfigured();
        }
        if (!IRoleManager(roleManager).hasRole(msg.sender, IRoleManager.Role.Manufacturer)) {
            revert UnauthorizedManufacturer(msg.sender);
        }
        if (batchId == bytes32(0)) {
            revert InvalidBatchId();
        }
        if (bytes(medicineName).length == 0) {
            revert EmptyMedicineName();
        }
        if (_batches[batchId].exists) {
            revert DuplicateBatch(batchId);
        }

        _batches[batchId] = Batch({
            batchId: batchId,
            medicineName: medicineName,
            batchMetadata: batchMetadata,
            manufacturer: msg.sender,
            createdAt: block.timestamp,
            exists: true
        });

        // Initialize custody on tracker
        ICustodyTracker(custodyTracker).initializeCustody(batchId, msg.sender);

        emit BatchRegistered(batchId, medicineName, msg.sender, block.timestamp);
    }

    /// @notice Checks if a batch exists in the registry.
    /// @param batchId The batch ID to query.
    /// @return True if registered, false otherwise.
    function batchExists(bytes32 batchId) external view override returns (bool) {
        return _batches[batchId].exists;
    }

    /// @notice Retrieves full batch details for an existing batch.
    /// @param batchId The batch ID to query.
    /// @return Batch struct with all stored attributes.
    function getBatch(bytes32 batchId) external view override returns (Batch memory) {
        return _batches[batchId];
    }
}
