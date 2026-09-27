package io.github.learnmonitor.arcanumoverlay;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

final class OverlayConfigRepair {
    private OverlayConfigRepair() {}

    static void ensure(Path configFile) {
        try {
            if (Files.exists(configFile) && Files.size(configFile) == 0) {
                Files.writeString(configFile,
                    "{\n  \"values\": {\n    \"example\": false\n  },\n  \"enabled\": false\n}\n");
            }
        } catch (IOException e) {
            throw new IllegalStateException("Unable to repair empty overlay configuration", e);
        }
    }
}
