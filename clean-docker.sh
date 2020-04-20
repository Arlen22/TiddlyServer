
docker run -it --rm \
-v $PWD:/bitrise/src \
-w /bitrise/src \
-e force_color_prompt=yes \
-e GRADLE_USER_HOME=/bitrise/src/.gradlew \
-e HOME=/bitrise/src \
-e NPM_CONFIG_PREFIX=/bitrise/src/.npm-packages \
quay.io/bitriseio/android-ndk bash
