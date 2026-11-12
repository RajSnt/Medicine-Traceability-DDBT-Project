// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IRoleManager.sol";
import "./interfaces/IBatchRegistry.sol";
import "./interfaces/ICustodyTracker.sol";

/**
 * @title CustodyTracker
 * @author Medicine Traceability MVP Team
 * @notice Tracks sequential custody transfers between authorized actors and exposes full audit history.
 * @dev Enforces the strict transition flow: Manufacturer -> Distributor -> Pharmacy -> Patient (terminal).
 */
contract CustodyTracker is ICustodyTracker {
    /// @notice Custom error thrown when an unauthorized caller invokes initialization.
    error OnlyRegistry(address caller);

    /// @notice Custom error thrown when interacting with an unregistered batch.
    error UnknownBatch(bytes32 batchId);

    /// @notice Custom error thrown when caller is not the current recorded custodian.
    error UnauthorizedCustodian(address caller, address currentCustodian);

    /// @notice Custom error thrown when the recipient address is invalid (e.g. address(0)).
    error InvalidRecipient();

    /// @notice Custom error thrown when a transfer does not follow the permitted supply-chain sequence.
    error InvalidRoleTransition(address from, address to);

    /// @notice Custom error thrown when a terminal role (Patient) attempts to transfer custody onward.
    error TerminalRole(address account);

    /// @notice Custom error thrown when constructor arguments contain the zero address.
    error InvalidAccount();

    /// @notice Reference to the RoleManager contract.
    address public immutable roleManager;

    /// @notice Reference to the BatchRegistry contract.
    address public immutable batchRegistry;

    /// @dev Internal mapping of batchId to chronological list of custody transfers.
    mapping(bytes32 => CustodyRecord[]) private _custodyHistory;

    /// @dev Internal mapping of batchId to the active custodian.
    mapping(bytes32 => address) private _currentCustodian;

    /// @notice Initializes references to RoleManager and BatchRegistry.
    /// @param _roleManager Address of deployed RoleManager.
    /// @param _batchRegistry Address of deployed BatchRegistry.
    constructor(address _roleManager, address _batchRegistry) {
        if (_roleManager == address(0) || _batchRegistry == address(0)) {
            revert InvalidAccount();
        }
        roleManager = _roleManager;
        batchRegistry = _batchRegistry;
    }

    /// @notice Initializes custody upon batch registration.
    /// @dev Callable solely by the authorized BatchRegistry contract.
    /// @param batchId The unique batch ID.
    /// @param manufacturer Address of the manufacturer creating the batch.
    function initializeCustody(bytes32 batchId, address manufacturer) external override {
        if (msg.sender != batchRegistry) {
            revert OnlyRegistry(msg.sender);
        }

        _currentCustodian[batchId] = manufacturer;
        _custodyHistory[batchId].push(CustodyRecord({
            from: address(0),
            to: manufacturer,
            timestamp: block.timestamp
        }));

        emit CustodyTransferred(batchId, address(0), manufacturer, block.timestamp);
    }

    /// @notice Transfers custody of a medicine batch to the next permitted actor.
    /// @dev Caller must be current custodian. Enforces Manufacturer -> Distributor -> Pharmacy -> Patient.
    /// @param batchId The unique batch ID.
    /// @param to Recipient address possessing the next allowed role.
    function transferCustody(bytes32 batchId, address to) external override {
        if (!IBatchRegistry(batchRegistry).batchExists(batchId)) {
            revert UnknownBatch(batchId);
        }
        if (to == address(0)) {
            revert InvalidRecipient();
        }

        address current = _currentCustodian[batchId];
        if (msg.sender != current) {
            revert UnauthorizedCustodian(msg.sender, current);
        }

        IRoleManager.Role senderRole = IRoleManager(roleManager).getRole(msg.sender);
        IRoleManager.Role recipientRole = IRoleManager(roleManager).getRole(to);

        // Terminal role check: Patient cannot transfer custody onward
        if (senderRole == IRoleManager.Role.Patient) {
            revert TerminalRole(msg.sender);
        }

        // Strict transition checks
        bool validTransition = false;
        if (senderRole == IRoleManager.Role.Manufacturer && recipientRole == IRoleManager.Role.Distributor) {
            validTransition = true;
        } else if (senderRole == IRoleManager.Role.Distributor && recipientRole == IRoleManager.Role.Pharmacy) {
            validTransition = true;
        } else if (senderRole == IRoleManager.Role.Pharmacy && recipientRole == IRoleManager.Role.Patient) {
            validTransition = true;
        }

        if (!validTransition) {
            revert InvalidRoleTransition(msg.sender, to);
        }

        _currentCustodian[batchId] = to;
        _custodyHistory[batchId].push(CustodyRecord({
            from: msg.sender,
            to: to,
            timestamp: block.timestamp
        }));

        emit CustodyTransferred(batchId, msg.sender, to, block.timestamp);
    }

    /// @notice Retrieves the complete chronological custody history for a batch.
    /// @param batchId The batch ID to query.
    /// @return Array of CustodyRecord structs from creation to current custodian.
    function getCustodyHistory(bytes32 batchId) external view override returns (CustodyRecord[] memory) {
        return _custodyHistory[batchId];
    }

    /// @notice Returns the current custodian address for a batch.
    /// @param batchId The batch ID to query.
    /// @return Address of the active custodian (or address(0) if uninitialized).
    function getCurrentCustodian(bytes32 batchId) external view override returns (address) {
        return _currentCustodian[batchId];
    }
}
