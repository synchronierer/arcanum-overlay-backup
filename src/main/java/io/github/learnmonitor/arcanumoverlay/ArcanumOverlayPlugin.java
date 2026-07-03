package io.github.learnmonitor.arcanumoverlay;

import de.igslandstuhl.database.plugins.Plugin;

public class ArcanumOverlayPlugin extends Plugin {
    private ArcanumOverlayConfig config;

    @Override
    protected void onLoad() {
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