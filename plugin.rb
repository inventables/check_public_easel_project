# frozen_string_literal: true

# name: check-public-project
# about: Check that Easel projects are shared publicly
# meta_topic_id: TODO
# version: 0.0.1
# authors: Discourse
# url: TODO
# required_version: 2.7.0

enabled_site_setting :check_public_project_enabled

module ::CheckPublicProject
  PLUGIN_NAME = "check-public-project"
end

require_relative "lib/check_public_project/engine"

after_initialize do
  # Code which should run after Rails has finished booting
end
