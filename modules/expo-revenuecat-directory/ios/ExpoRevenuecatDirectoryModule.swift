import ExpoModulesCore
import Foundation

public class ExpoRevenuecatDirectoryModule: Module {
    public func definition() -> ModuleDefinition {
        Name("ExpoRevenuecatDirectory")
        
        Function("ensureDirectory") {
            return ensureRevenueCatDirectory()
        }
    }
    
    /**
     * Ensures the RevenueCat cache directory exists
     * Creates the directory at: Documents/com.maak.health.revenuecat.etags/
     * This prevents NSCocoaErrorDomain Code=4 errors when RevenueCat tries to cache data
     */
    private func ensureRevenueCatDirectory() -> Bool {
        guard let documentsDirectory = FileManager.default.urls(
            for: .documentDirectory,
            in: .userDomainMask
        ).first else {
            print("[ExpoRevenuecatDirectory] ERROR: Could not get documents directory")
            return false
        }
        
        // RevenueCat cache directory path
        let revenueCatDirectory = documentsDirectory.appendingPathComponent(
            "com.maak.health.revenuecat.etags",
            isDirectory: true
        )
        
        // Check if directory already exists and is valid
        var isDirectory: ObjCBool = false
        let exists = FileManager.default.fileExists(
            atPath: revenueCatDirectory.path,
            isDirectory: &isDirectory
        )
        
        if exists && isDirectory.boolValue {
            // Directory exists - verify it's writable
            if FileManager.default.isWritableFile(atPath: revenueCatDirectory.path) {
                print("[ExpoRevenuecatDirectory] Directory already exists and is writable: \(revenueCatDirectory.path)")
                return true
            } else {
                print("[ExpoRevenuecatDirectory] WARNING: Directory exists but is not writable, attempting to fix permissions")
                // Try to fix permissions instead of recreating
                do {
                    try FileManager.default.setAttributes(
                        [.posixPermissions: 0o755],
                        ofItemAtPath: revenueCatDirectory.path
                    )
                    if FileManager.default.isWritableFile(atPath: revenueCatDirectory.path) {
                        print("[ExpoRevenuecatDirectory] Successfully fixed directory permissions")
                        return true
                    }
                } catch {
                    print("[ExpoRevenuecatDirectory] Failed to fix permissions, will recreate directory")
                }
            }
        }
        
        // Create directory if it doesn't exist or needs to be recreated
        do {
            // Remove existing file/directory if it exists but isn't a proper directory
            if exists && !isDirectory.boolValue {
                try? FileManager.default.removeItem(at: revenueCatDirectory)
            }
            
            // Create directory with intermediate directories
            // Use createDirectory which is synchronous and atomic
            try FileManager.default.createDirectory(
                at: revenueCatDirectory,
                withIntermediateDirectories: true,
                attributes: [
                    .posixPermissions: 0o755  // rwxr-xr-x permissions
                ]
            )
            
            // Verify the directory was created successfully and is writable
            var verifyIsDirectory: ObjCBool = false
            let verifyExists = FileManager.default.fileExists(
                atPath: revenueCatDirectory.path,
                isDirectory: &verifyIsDirectory
            )
            
            if verifyExists && verifyIsDirectory.boolValue && FileManager.default.isWritableFile(atPath: revenueCatDirectory.path) {
                print("[ExpoRevenuecatDirectory] Successfully created directory: \(revenueCatDirectory.path)")
                return true
            } else {
                print("[ExpoRevenuecatDirectory] ERROR: Directory creation verification failed")
                print("[ExpoRevenuecatDirectory] Exists: \(verifyExists), IsDirectory: \(verifyIsDirectory.boolValue), Writable: \(FileManager.default.isWritableFile(atPath: revenueCatDirectory.path))")
                return false
            }
        } catch {
            // Log detailed error information
            print("[ExpoRevenuecatDirectory] ERROR: Failed to create directory at \(revenueCatDirectory.path)")
            print("[ExpoRevenuecatDirectory] Error details: \(error.localizedDescription)")
            if let nsError = error as NSError? {
                print("[ExpoRevenuecatDirectory] Error domain: \(nsError.domain), code: \(nsError.code)")
                print("[ExpoRevenuecatDirectory] Error userInfo: \(nsError.userInfo)")
            }
            return false
        }
    }
}

