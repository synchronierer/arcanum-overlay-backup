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