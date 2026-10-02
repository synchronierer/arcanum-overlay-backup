import org.gradle.language.jvm.tasks.ProcessResources

plugins {
    java
}

repositories {
    mavenCentral()
    maven {
        name = "GitHubPackages"
        url = uri("https://maven.pkg.github.com/Learn-Monitor/student-database/")
        credentials {
            username = System.getenv("GITHUB_ACTOR")
            password = System.getenv("GITHUB_TOKEN")
        }
    }
}

val studentDatabaseJar = providers.gradleProperty("studentDatabaseJar")

dependencies {
    if (studentDatabaseJar.isPresent) {
        compileOnly(files(studentDatabaseJar.get()))
        runtimeOnly(files(studentDatabaseJar.get()))
    } else {
        compileOnly("igs-landstuhl:student-database:v2.0.0-SNAPSHOT-3")
        runtimeOnly("igs-landstuhl:student-database:v2.0.0-SNAPSHOT-3")
    }

    compileOnly("org.slf4j:slf4j-api:2.0.13")

    // test framework (optional)
    testImplementation("org.junit.jupiter:junit-jupiter:5.13.4")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(17))
    }
}

tasks.withType<Jar> {
    manifest {
        attributes["Implementation-Title"] = "Arcanum Overlay Plugin"
        attributes["Implementation-Version"] = project.version
    }
}

val generatedWebPaths = layout.buildDirectory.file("generated-resources/main/meta/paths/get_paths.json")

val generateWebPaths = tasks.register("generateWebPaths") {
    val basePaths = file("src/main/resources/meta/paths/get_paths.json")
    val imageRoots = listOf(
        file("src/main/resources/imgs/login") to "login",
        file("src/main/resources/imgs/inspiration") to "inspiration",
    )
    inputs.file(basePaths)
    imageRoots.forEach { (root, _) -> inputs.files(fileTree(root) { include("*.webp") }) }
    outputs.file(generatedWebPaths)

    doLast {
        val base = basePaths.readText().trim()
        val additions = imageRoots.flatMap { (root, namespace) ->
            root.listFiles()?.filter { it.isFile && it.extension == "webp" }?.sortedBy { it.name }?.map { image ->
                val route = "/${image.name}"
                if (base.contains("\"$route\"")) "" else """    "$route": {
        "type": "GET",
        "handler_type": "FileRequestHandler",
        "namespaces": ["$namespace"],
        "context": "imgs",
        "access_level": "public"
    }"""
            } ?: emptyList()
        }.filter(String::isNotEmpty)
        val result = if (additions.isEmpty()) base + "\n" else
            base.removeSuffix("}").trimEnd() + ",\n" + additions.joinToString(",\n") + "\n}\n"
        generatedWebPaths.get().asFile.apply {
            parentFile.mkdirs()
            writeText(result)
        }
    }
}

tasks.named<ProcessResources>("processResources") {
    dependsOn(generateWebPaths)
    duplicatesStrategy = DuplicatesStrategy.INCLUDE
    from(generatedWebPaths) {
        into("meta/paths")
        rename { "get_paths.json" }
    }
}

// test configuration
tasks.test {
    useJUnitPlatform()
}

tasks.register<Copy>("deployPluginJar") {
    dependsOn(tasks.jar)

    from(tasks.jar)
    into(layout.buildDirectory.dir("debug-run/plugins"))
}
val runtimeClasspath = configurations.runtimeClasspath

tasks.register("printRuntimeClasspath") {
    val classpath = runtimeClasspath.map { it.asPath }

    doLast {
        println(classpath.get())
    }
}

version = "v1.0.1"
group = "io.github.learn-monitor"
