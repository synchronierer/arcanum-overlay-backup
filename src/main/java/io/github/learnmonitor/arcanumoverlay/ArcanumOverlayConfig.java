package io.github.learnmonitor.arcanumoverlay;

import de.igslandstuhl.database.plugins.config.BoolSetting;
import de.igslandstuhl.database.plugins.config.PluginConfig;
import de.igslandstuhl.database.plugins.config.PluginSetting;

public class ArcanumOverlayConfig extends PluginConfig<ArcanumOverlayPlugin> {
    private final BoolSetting exampleSetting;

    private ArcanumOverlayConfig(ArcanumOverlayPlugin plugin, BoolSetting exampleSetting) {
        super(plugin, new PluginSetting[] {exampleSetting});
        this.exampleSetting = exampleSetting;
    }
    ArcanumOverlayConfig(ArcanumOverlayPlugin plugin) {
        this(plugin,
            new BoolSetting("example", "Example Setting", "Does nothing", false)
        );
    }

    public boolean isExample() {
        return exampleSetting.isEnabled();
    }
}
