package io.github.learnmonitor.arcanumoverlay;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

class OverlayResourceRegistrationTest {
    @Test
    void everyHashedImageResourceHasARegisteredWebPath() throws Exception {
        Path resources = Path.of("src/main/resources");
        String paths = Files.readString(Path.of("build/resources/main/meta/paths/get_paths.json"));
        try (Stream<Path> files = Files.walk(resources.resolve("imgs"))) {
            files.filter(Files::isRegularFile)
                .filter(path -> path.getFileName().toString().endsWith(".webp"))
                .forEach(path -> assertTrue(paths.contains("\"/" + path.getFileName() + "\""),
                    "missing registration for " + path));
        }
    }
}
