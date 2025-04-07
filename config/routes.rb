# frozen_string_literal: true

CheckPublicProject::Engine.routes.draw do
  get "/examples" => "examples#index"
  # define routes here
end

Discourse::Application.routes.draw { mount ::CheckPublicProject::Engine, at: "check-public-project" }
