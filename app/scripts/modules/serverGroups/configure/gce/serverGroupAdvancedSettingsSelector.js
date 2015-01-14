'use strict';

angular.module('deckApp.serverGroup.configure.gce')
  .directive('gceServerGroupAdvancedSettingsSelector', function() {
    return {
      restrict: 'E',
      scope: {
        command: '=',
      },
      templateUrl: 'scripts/modules/serverGroups/configure/gce/serverGroupAdvancedSettingsDirective.html',
      controller: 'gceServerGroupAdvancedSettingsSelectorCtrl as advancedSettingsCtrl',
    };
  })
  .controller('gceServerGroupAdvancedSettingsSelectorCtrl', function($scope) {
    this.addInstanceMetadata = function() {
      $scope.command.instanceMetadata.push({});
    };

    this.removeInstanceMetadata = function(index) {
      $scope.command.instanceMetadata.splice(index, 1);
    };

  });
