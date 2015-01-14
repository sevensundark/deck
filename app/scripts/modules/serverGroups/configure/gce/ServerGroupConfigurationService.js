'use strict';

angular.module('deckApp.serverGroup.configure.gce')
  .factory('gceServerGroupConfigurationService', function(imageService, accountService, securityGroupService,
                                                          instanceTypeService,
                                                          $q, loadBalancerReader) {


    function configureCommand(command) {
      command.image = command.viewState.imageId;
      return $q.all({
        regionsKeyedByAccount: accountService.getRegionsKeyedByAccount(),
        loadBalancers: loadBalancerReader.listGCELoadBalancers(),
        instanceTypes: instanceTypeService.getAllTypesByRegion('gce'),
        images: imageService.findImages({provider: 'gce'})
      }).then(function(loader) {
        loader.accounts = _.keys(loader.regionsKeyedByAccount);
        loader.filtered = {};
        command.backingData = loader;
        configureImages(command);
        attachEventHandlers(command);
      });
    }

    function configureInstanceTypes(command) {
      var result = { dirty: {} };
      if (command.region) {
        var filtered = instanceTypeService.getAvailableTypesForRegions('gce', command.backingData.instanceTypes, [command.region]);
        if (command.instanceType && filtered.indexOf(command.instanceType) === -1) {
          command.instanceType = null;
          result.dirty.instanceType = true;
        }
        command.backingData.filtered.instanceTypes = filtered;
      } else {
        command.backingData.filtered.instanceTypes = [];
      }
      return result;
    }

    function configureImages(command) {
      var result = { dirty: {} };
      // TODO(duftler): Dynamically populate this field with the correct set of images based on region/zone/project
      if (command.viewState.disableImageSelection) {
        return result;
      }
      if (command.credentials !== command.viewState.lastImageAccount) {
        command.viewState.lastImageAccount = command.credentials;
        var filtered = extractFilteredImageNames(command);
        command.backingData.filtered.imageNames = filtered;
        if (filtered.indexOf(command.image) === -1) {
          command.image = null;
          result.dirty.imageName = true;
        }
      }
      return result;
    }

    function configureZones(command) {
      command.backingData.filtered.zones =
        command.backingData.regionsKeyedByAccount[command.credentials].regions[command.region];
    }

    function configureLoadBalancerOptions(command) {
      var results = { dirty: {} };
      var current = command.loadBalancers;
      var newLoadBalancers = _(command.backingData.loadBalancers)
        .pluck('accounts')
        .flatten(true)
        .filter({name: command.credentials})
        .pluck('regions')
        .flatten(true)
        .filter({name: command.region})
        .pluck('loadBalancers')
        .flatten(true)
        .pluck('name')
        .unique()
        .valueOf();

      if (current && command.loadBalancers) {
        var matched = _.intersection(newLoadBalancers, command.loadBalancers);
        var removed = _.xor(matched, current);
        command.loadBalancers = matched;
        if (removed.length) {
          results.dirty.loadBalancers = removed;
        }
      }
      command.backingData.filtered.loadBalancers = newLoadBalancers;
      return results;
    }

    function extractFilteredImageNames(command) {
      return _(command.backingData.images)
        .filter({account: command.credentials})
        .pluck('imageName')
        .flatten(true)
        .unique()
        .valueOf();
    }

    function attachEventHandlers(command) {

      command.regionChanged = function regionChanged() {
        var result = { dirty: {} };
        var filteredData = command.backingData.filtered;
        if (command.region) {
          angular.extend(result.dirty, configureInstanceTypes(command).dirty);

          configureZones(command);

          angular.extend(result.dirty, configureLoadBalancerOptions(command).dirty);
          angular.extend(result.dirty, configureImages(command).dirty);
        } else {
          filteredData.zones = null;
        }

        return result;
      };

      command.credentialsChanged = function credentialsChanged() {
        var result = { dirty: {} };
        var backingData = command.backingData;
        if (command.credentials) {
          backingData.filtered.regions = Object.keys(backingData.regionsKeyedByAccount[command.credentials].regions);
          if (backingData.filtered.regions.indexOf(command.region) === -1) {
            command.region = null;
            result.dirty.region = true;
          } else {
            angular.extend(result.dirty, command.regionChanged().dirty);
          }
        } else {
          command.region = null;
        }
        return result;
      };

      command.transformInstanceMetadata = function() {
        var transformedInstanceMetadata = {};

        // The instanceMetadata is stored using 'key' and 'value' attributes to enable the Add/Remove behavior in the wizard.
        command.instanceMetadata.forEach(function(metadataPair) {
          transformedInstanceMetadata[metadataPair.key] = metadataPair.value;
        });

        // We use this list of load balancer names when 'Enabling' a server group.
        if (command.loadBalancers.length > 0) {
          transformedInstanceMetadata['load-balancer-names'] = command.loadBalancers.toString();
        }

        command.instanceMetadata = transformedInstanceMetadata;
      };
    }

    return {
      configureCommand: configureCommand,
      configureInstanceTypes: configureInstanceTypes,
      configureImages: configureImages,
      configureZones: configureZones,
      configureLoadBalancerOptions: configureLoadBalancerOptions,
    };


  });
