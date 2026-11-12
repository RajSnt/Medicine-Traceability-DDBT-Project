// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title IRoleManager
 * @notice Interface for role lookup and access control in the medicine traceability system.
 */
interface IRoleManager {
    enum Role {
        None,
        Admin,
        Manufacturer,
        Distributor,
        Pharmacy,
        Patient
    }

    function registerRole(address account, Role role) external;
    function getRole(address account) external view returns (Role);
    function hasRole(address account, Role role) external view returns (bool);
    function admin() external view returns (address);
}
