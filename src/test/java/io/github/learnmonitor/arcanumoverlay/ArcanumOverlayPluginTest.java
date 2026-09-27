package io.github.learnmonitor.arcanumoverlay;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

class ArcanumOverlayPluginTest {
    @Test
    void repairsOnlyAnExistingEmptyConfigurationWithValidDefaults() throws Exception {
        Path config = Files.createTempFile("arcanum-overlay", ".json");
        try {
            assertEquals(0, Files.size(config));
            OverlayConfigRepair.ensure(config);
            String content = Files.readString(config);
            assertTrue(content.contains("\"values\""));
            assertTrue(content.contains("\"example\": false"));
            assertTrue(content.contains("\"enabled\": false"));
        } finally {
            Files.deleteIfExists(config);
        }
    }

    @Test
    void leavesAnExistingValidConfigurationUntouched() throws Exception {
        Path config = Files.createTempFile("arcanum-overlay", ".json");
        try {
            String content = "{\"values\":{\"example\":true},\"enabled\":true}";
            Files.writeString(config, content);
            OverlayConfigRepair.ensure(config);
            assertEquals(content, Files.readString(config));
        } finally {
            Files.deleteIfExists(config);
        }
    }
}
