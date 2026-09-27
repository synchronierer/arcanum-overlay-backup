package io.github.learnmonitor.arcanumoverlay;

import de.igslandstuhl.database.plugins.Plugin;

import java.nio.file.Path;
import java.nio.file.Paths;

public class ArcanumOverlayPlugin extends Plugin {
    private ArcanumOverlayConfig config;

    @Override
    protected void onLoad() {
        OverlayConfigRepair.ensure(Paths.get("plugins", "config", "arcanum-overlay.json"));
        config = new ArcanumOverlayConfig(this);
        getLogger().info("Example plugin loaded.");
    }

    @Override
    protected void onEnable() {}

    @Override
    protected void onDisable() {}

    @Override
    public ArcanumOverlayConfig getConfig() {
        return config;
    }
}
