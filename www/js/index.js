/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
//SID SKdcb66f5c054b30dba96844fbfe978276
//Secret D80b1hDbu6QrRt5nhBEsM4dGdMU5zCQv

var accessManager;
var activeChannel;
var client;
var typingMembers = new Set();

var activeChannelPage;

var userContext = { identity: null, endpoint: null };

ons.ready(function() {
    $('body').delegate('#back-to-channels','click',function(){
        updateChannels();
        fn.load('./views/channels-list.html');
        setTimeout(function(){
            $('#profile label').text(userContext.identity);
            $('#profile-avatar').attr('src', 'http://gravatar.com/avatar/' + MD5(userContext.identity) + '?s=40&d=mm&r=g');                
        },100);
    });
    
    $('#login-name').focus();
    
    $("body").delegate('#login-button','click', function() {        
        var identity = $('#login-name').val();
        
        if (!identity) { return; }

        userContext.identity = identity;

        //Log client into twilio chat        
        logIn(identity, identity);        
    });

    //Allow submitting login input field by pressing enter key
    $('#login-name').on('keydown', function(e) {
        if (e.keyCode === 13) { $('#login-button').click(); }
    });

    //Allow submitting message by pressing enter key
    $('body').delegate('#message-body-input', 'keydown', function(e) {
        if (e.keyCode === 13 && !e.shiftKey) { 
            e.preventDefault();
            $('#send-message').click(); 
        }else if (activeChannel) { 
            activeChannel.typing(); 
        }
    });

    $('#edit-channel').on('click', function() {
        $('#update-channel-display-name').val(activeChannel.friendlyName || '');
        $('#update-channel-unique-name').val(activeChannel.uniqueName || '');
        $('#update-channel-desc').val(activeChannel.attributes.description || '');
        $('#update-channel-private').prop('checked', activeChannel.isPrivate);
        $('#update-channel').show();
    });

    var isUpdatingConsumption = false;    
    
    $('body').delegate('#channel-messages','touchmove', function(e) {        
        var $messages = $('#channel-messages');

        //When we are close to the bottom of the page if another user sends a new message, scroll to the bottom fo the page
        //so we can see the new message
        if ($('#channel-messages ul').height() - 50 < $messages.scrollTop() + $messages.height()) {
            activeChannel.getMessages(1).then(messages => {
                var newestMessageIndex = messages['items'].length ? messages['items'][0]['index'] : 0;
                
                if (!isUpdatingConsumption && activeChannel.lastConsumedMessageIndex !== newestMessageIndex) {                    
                    isUpdatingConsumption = true;
                    activeChannel.updateLastConsumedMessageIndex(newestMessageIndex).then(function() {
                        isUpdatingConsumption = false;
                    });
                }
            });
        }

        var self = $(this);
        //When a channel loads first it shows the latest messages at the bottom of the page. When scroll towards the top
        //only then are older messaged loaded
        if($messages.scrollTop() < 50 && activeChannelPage && activeChannelPage.hasPrevPage && !self.hasClass('loader')) {
            self.addClass('loader');            
            var initialHeight = $('ul', self).height();
            
            activeChannelPage.prevPage().then(page => {
                page.items.reverse().forEach(prependMessage);
                activeChannelPage = page;
                var difference = $('ul', self).height() - initialHeight;
                self.scrollTop(difference);
                self.removeClass('loader');
            });
        }
    });

    $('#update-channel .remove-button').on('click', function() {
        $('#update-channel').hide();
    });

    $('#delete-channel').on('click', function() {
        $('#back-to-channels').click();
        activeChannel && activeChannel.delete();
    });

    $('#join-channel').on('click', function() {
        activeChannel.join().then(setActiveChannel);
    });

    $('#invite-user').on('click', function() {
        $('#invite-member').show();
    });

    $('#add-user').on('click', function() {
        $('#add-member').show();
    });

    $('#invite-button').on('click', function() {
        var identity = $('#invite-identity').val();
        identity && activeChannel.invite(identity).then(function() {
            $('#invite-member').hide();
            $('#invite-identity').val('');
        });
    });

    $('body').delegate('#add-button', 'click', function() {
        var identity = $('#add-identity').val();
        identity && activeChannel.add(identity).then(function() {
            //$('#add-member').hide();
            $('#add-member-dialog').hide();
            $('#add-identity').val('');
        });
    });

    $('#invite-member .remove-button').on('click', function() {
        $('#invite-member').hide();
    });

    $('#add-member .remove-button').on('click', function() {
        $('#add-member').hide();
    });

    $('#create-channel .remove-button').on('click', function() {
        $('#create-channel').hide();
    });

    $('#create-channel-button').on('click', function() {
        $('#create-channel').show();
    });
    
    $('body').delegate('#create-new-channel','click',function(){
        var attributes = {
            description: $('#create-channel-desc').val()
        };

        var isPrivate = $('#create-channel-private').is(':checked');
        var friendlyName = $('#create-channel-display-name').val();
        var uniqueName = $('#create-channel-unique-name').val();
        
        client.createChannel({
            attributes: attributes,
            friendlyName: friendlyName,
            isPrivate: isPrivate,
            uniqueName: uniqueName
        }).then(function joinChannel(channel) {
            $('#channel-create-dialog').hide();
            //$('#create-channel').hide();
            return channel.join();
        }).then(setActiveChannel);
    });

    $('#update-channel-submit').on('click', function() {
        var desc = $('#update-channel-desc').val();
        var friendlyName = $('#update-channel-display-name').val();
        var uniqueName = $('#update-channel-unique-name').val();

        var promises = [];
        if (desc !== activeChannel.attributes.description) {
            promises.push(activeChannel.updateAttributes({ description: desc }));
        }

        if (friendlyName !== activeChannel.friendlyName) {
            promises.push(activeChannel.updateFriendlyName(friendlyName));
        }

        if (uniqueName !== activeChannel.uniqueName) {
            promises.push(activeChannel.updateUniqueName(uniqueName));
        }

        Promise.all(promises).then(function() {
            $('#update-channel').hide();
        });
    });
    
    $('body').delegate('#open-channel-dialog','click',function(){
        $('#channel-create-dialog').show();
    });
    
    $('body').delegate('#open-add-member-dialog','click',function(){        
        showPopover('add-member-dialog');
    });
    
    $('body').delegate('.dialog-mask', 'click', function(){
        $('ons-dialog').hide();
    });
    
    $('#chatMenu').delegate('ons-list-item', 'click', function(){
        var menu = document.getElementById('chatMenu');
        menu.close();
    });
});

window.fn = {};

window.fn.openChatMenu = function () {
    var menu = document.getElementById('chatMenu');
    menu.open();
};

window.fn.load = function (page) {
    var content = document.getElementById('content');
    var menu = document.getElementById('chatMenu');
    content
            .load(page)
            .then(menu.close.bind(menu));
};

//Login with google and user google email as username
function googleLogIn(googleUser) {
    var profile = googleUser.getBasicProfile();
    var identity = profile.getEmail().toLowerCase();
    var fullName = profile.getName();
    logIn(identity, fullName);
}

function logIn(identity, displayName) {
    var endpointId = MD5(identity);
    //Get access token from twilio SDK(on server)
    $.ajax({
        url: 'https://www.microtrain.net/twilio/twilio/test_token/' + identity + '/' + endpointId +'/',
        type: "GET",
        success: function(data, textStatus, jqXHR) {
            fn.load('./views/channels-list.html');
            var token = data;

            userContext.identity = identity;
            userContext.endpoint = endpointId;            

            //Create new chat client instance
            client = new Twilio.Chat.Client(token, { logLevel: 'debug' });

            //Create new AccessManager instance to track when token expires and update it when it does
            accessManager = new Twilio.AccessManager(token);
            accessManager.on('tokenUpdated', am => client.updateToken(am.token));
            accessManager.on('tokenExpired', () => {
                $.ajax({
                    url: 'https://www.microtrain.net/twilio/twilio/test_token/' + identity + '/' + endpointId +'/',
                    type: "GET",
                    success: function(data, textStatus, jqXHR) {
                        console.log('Got new token!', data);
                        accessManager.updateToken(data);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error('Failed to get a token ', data);
                        throw new Error(errorThrown);
                    }
                })
            });
            
            setTimeout(function(){
                $('#profile label').text(client.userInfo.friendlyName || client.userInfo.identity);
                $('#profile-avatar').attr('src', 'http://gravatar.com/avatar/' + MD5(identity) + '?s=40&d=mm&r=g');                
            },100);
            
            
            client.userInfo.on('updated', function() {
                $('#profile label').text(client.userInfo.friendlyName || client.userInfo.identity);
            });

            var connectionInfo = $('#profile #presence');
            connectionInfo
              .removeClass('online offline connecting denied')
              .addClass(client.connectionState);
            
            //Set listener for when connection state changes and update label and light
            client.on('connectionStateChanged', function(state) {
              connectionInfo
                .removeClass('online offline connecting denied')
                .addClass(client.connectionState);
            });
            
            //Fetch all channels the user attached to
            //updateChannels();

            //Set listeners for when a client joins a channel and when a message is added to that channel
            client.on('channelJoined', function(channel) {
                channel.on('messageAdded', updateUnreadMessages);
                channel.on('messageAdded', updateChannels);
                updateChannels();
            });

            client.on('channelInvited', updateChannels);
            client.on('channelAdded', updateChannels);
            client.on('channelUpdated', updateChannels);
            client.on('channelLeft', leaveChannel);
            client.on('channelRemoved', leaveChannel);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            throw new Error(errorThrown);
        }
    });
}

//When we there is a new message sent in a channel which is not the active channel, denote in the sidebar that there is
//a new message in a inactive chennel
function updateUnreadMessages(message) {
    var channel = message.channel;
    if (channel !== activeChannel) {
        $('#sidebar li[data-sid="' + channel.sid + '"] span').addClass('new-messages');
    }
}

//Removes client from channel and removes message listener for that channel
function leaveChannel(channel) {
    if (channel == activeChannel && channel.status !== 'joined') {
        clearActiveChannel();
    }

    channel.removeListener('messageAdded', updateUnreadMessages);

    updateChannels();
}

//Not sure what is considered a known channel
function addKnownChannel(channel) {
    if($('ons-list-item[data-sid='+channel.sid+']').length==0){
        var $el = $('<ons-list-item tappable/>')
            .text(channel.friendlyName)
            .attr('data-sid', channel.sid)            
            .on('click', function() {
                setActiveChannel(channel);
            });
        /*
        var $title = $('<div/>')
            .addClass('list-item__center')
            .text(channel.friendlyName)
            .appendTo($el);
        */

        $('#known-channels ons-list').append($el);
    }
}

//Adds a client to a channel they have been invited to. In this case channel label has a button wich allows client to
//decline invitation
function addInvitedChannel(channel) {
    if($('li[data-sid='+channel.sid+']').length==0){
        var $el = $('<li/>')
            .attr('data-sid', channel.sid)
            .addClass('list-item list-item--tappable')
            .on('click', function() {
                setActiveChannel(channel);
            });

        var $title = $('<div class="invited"/>')
            .addClass('list-item__center')
            .text(channel.friendlyName)
            .appendTo($el);

        var $decline = $('<div class="remove-button glyphicon glyphicon-remove"/>')
            .on('click', function(e) {
                e.stopPropagation();
                channel.decline();
            }).appendTo($el);

        $('#invited-channels ul').append($el);
    }
}

//Adds a channel to the sidebar which the user has previously joined. Channel label has a button that allows client to
//leave channel
function addJoinedChannel(channel) {
    
    if($('ons-list-item[data-sid='+channel.sid+']').length==0){
        var $el = $('<ons-list-item tappable/>')
            .text(channel.friendlyName)
            .attr('data-sid', channel.sid)            
            .on('click', function() {
                setActiveChannel(channel);
            });
        /*
        var $title = $('<div class="joined"/>')
            .addClass('list-item__center')
            .text(channel.friendlyName)
            .appendTo($el);
        */

        var $count = $('<span class="messages-count"/>')
            .appendTo($el);

      /*
      channel.getUnreadMessagesCount().then(count => {
        if (count > 0) {
          $el.addClass('new-messages');
          $count.text(count);
        }
      });
      */
        
        var $leave = $('<div class="remove-button glyphicon glyphicon-remove"/>')
        .on('click', function(e) {
            e.stopPropagation();
            channel.leave();
        }).appendTo($el);
       
        $('#my-channels ons-list').append($el);
    }
}

//Removes a channel
function removeLeftChannel(channel) {
    $('#my-channels li[data-sid=' + channel.sid + ']').remove();

    if (channel === activeChannel) {
        clearActiveChannel();
    }
}

//Get last 30 messages
function updateMessages() {
    $('#channel-messages ul').empty();
    activeChannel.getMessages(30).then(function(page) {
        page.items.forEach(addMessage);
    });
}

//Remove message from channel
function removeMessage(message) {
    $('#channel-messages li[data-index=' + message.index + ']').remove();
}

//Updates message
function updateMessage(message) {
    var $el = $('#channel-messages li[data-index=' + message.index + ']');
    $el.empty();
    createMessage(message, $el);
}

//Creates a new message
function createMessage(message, $el) {
    //Remove message button
    /*
    var $remove = $('<div class="remove-button glyphicon glyphicon-remove"/>')
        .on('click', function(e) {
            e.preventDefault();
            message.remove();
        }).appendTo($el);

    //Edit message button
    var $edit = $('<div class="remove-button glyphicon glyphicon-edit"/>')
        .on('click', function(e) {
            e.preventDefault();
            $('.body', $el).hide();
            $('.edit-body', $el).show();
            $('button', $el).show();
            $el.addClass('editing');
        }).appendTo($el);
    */    

    //Message author name
    var $author = $('<div style="clear:both;" class="author"/>')
        .appendTo($el);

    if(message.author == userContext.identity){
        var float = 'right';
        var bodyClass = 'triangle-right top';
    }else{
        var float = 'left';
        var bodyClass = 'triangle-left top';
    }

    var $authorName = $('<div style="float:'+float+'; margin-bottom:10px;"/>')
        .text(message.author)
        .appendTo($author);    

    //Generate message timestamp
    var time = message.timestamp;
    var minutes = time.getMinutes();
    var ampm = Math.floor(time.getHours()/12) ? 'PM' : 'AM';

    if (minutes < 10) { minutes = '0' + minutes; }

    //Add timestamp to message
    var $timestamp = $('<span class="timestamp"/>')
        .text('(' + (time.getHours()%12) + ':' + minutes + ' ' + ampm + ')')
        .appendTo($authorName);


    //Message author image
    var $img = $('<img style="float:'+float+'"/>')
        .attr('src', 'http://gravatar.com/avatar/' + MD5(message.author) + '?s=30&d=mm&r=g')
        .appendTo($authorName);

    //If message has been updated, show who upated it and when
    if (message.lastUpdatedBy) {
        time = message.dateUpdated;
        minutes = time.getMinutes();
        ampm = Math.floor(time.getHours()/12) ? 'PM' : 'AM';

        if (minutes < 10) { minutes = '0' + minutes; }

        $('<span class="timestamp"/>')
            .text('(Edited by ' + message.lastUpdatedBy + ' at ' +
            (time.getHours()%12) + ':' + minutes + ' ' + ampm + ')')
            .appendTo($author)
    }

    var $body = $('<div style="padding:5px; clear:both" class="body '+bodyClass+'"/>')
        .text(message.body)
        .appendTo($el);

    /*
    //Add input element allowing us to edit message
    var $editBody = $('<textarea class="edit-body"/>')
        .text(message.body)
        .appendTo($el);

    //Add message edit cancelation button
    var $cancel = $('<button class="cancel-edit"/>')
        .text('Cancel')
        .on('click', function(e) {
            e.preventDefault();
            $('.edit-body', $el).hide();
            $('button', $el).hide();
            $('.body', $el).show();
            $el.removeClass('editing');
        }).appendTo($el);
    
    //Add message edit submit button
    var $edit = $('<button class="red-button"/>')
        .text('Make Change')
        .on('click', function(e) {
            message.updateBody($editBody.val());
        }).appendTo($el);
    */
    //Add indicator that there is a new message which has not been read
    var $lastRead = $('<p class="last-read"/>')
        .text('New messages')
        .appendTo($el);

    /*
    var $membersRead = $('<p class="members-read"/>')
        .appendTo($el);
    */
}

//Prepend message to top of the channel(used for showing old messages)
function prependMessage(message) {
    var $messages = $('#channel-messages');
    var $el = $('<li/>').attr('data-index', message.index);
    createMessage(message, $el);
    $('#channel-messages ul').prepend($el);
}

//Append message to bottom of the channel(used for showing new messages)
function addMessage(message) {
    var $messages = $('#channel-messages');
    var initHeight = $('#channel-messages ul').height();
    var $el = $('<li/>').attr('data-index', message.index);
    createMessage(message, $el);

    $('#channel-messages ul').append($el);

    if (initHeight - 50 < $messages.scrollTop() + $messages.height()) {
        $messages.scrollTop($('#channel-messages ul').height());
    }

    if ($('#channel-messages ul').height() <= $messages.height() &&
        message.index > message.channel.lastConsumedMessageIndex) {
        message.channel.updateLastConsumedMessageIndex(message.index);
    }
}

//Adds new member to channel
function addMember(member) {
    var $el = $('<li/>').attr('data-identity', member.userInfo.identity);

    var $img = $('<img/>')
        .attr('src', 'http://gravatar.com/avatar/' + MD5(member.identity.toLowerCase()) + '?s=20&d=mm&r=g')
        .appendTo($el);


    let hasReachability = (member.userInfo.online !== null) && (typeof member.userInfo.online !== 'undefined');
    var $span = $('<span/>')
        .text(member.userInfo.friendlyName || member.userInfo.identity)
        .addClass(hasReachability ? ( member.userInfo.online ? 'member-online' : 'member-offline' ) : '')
        .appendTo($el);

    var $remove = $('<div class="remove-button glyphicon glyphicon-remove"/>')
        .on('click', member.remove.bind(member))
        .appendTo($el);

    updateMember(member);

    $('#channel-members ul').append($el);
}

//Updates the members of the active channel
function updateMembers() {
  $('#channel-members ul').empty();

  activeChannel.getMembers()
    .then(members => members
        .sort(function(a, b) { return a.identity > b.identity; })
        .sort(function(a, b) { return a.userInfo.online < b.userInfo.online; })
        .forEach(addMember));

}

//Updates all channels of which the user is a member
function updateChannels() {    
    $('#known-channels ul').empty();
    $('#invited-channels ul').empty();
    //$('#my-channels ul').empty();

    client.getUserChannels()
        .then(page => {
            channels = page.items.sort(function(a, b) {
                return a.friendlyName > b.friendlyName;
            });
            
            channels.forEach(function(channel) {                
                switch (channel.status) {
                    case 'joined':
                        addJoinedChannel(channel);
                    break;
                    case 'invited':
                        addInvitedChannel(channel);
                    break;
                    default:
                        addKnownChannel(channel);
                    break;
                }
            });
        })
}

function updateMember(member) {
    if (member.identity === decodeURIComponent(client.identity)) { return; }

    var $lastRead = $('#channel-messages p.members-read img[data-identity="' + member.identity + '"]');

    if (!$lastRead.length) {
        $lastRead = $('<img/>')
            .attr('src', 'http://gravatar.com/avatar/' + MD5(member.identity) + '?s=20&d=mm&r=g')
            .attr('title', member.userInfo.friendlyName || member.userInfo.identity)
            .attr('data-identity', member.identity);
    }

    var lastIndex = member.lastConsumedMessageIndex;
    if (lastIndex) {
        $('#channel-messages li[data-index=' + lastIndex + '] p.members-read').append($lastRead);
    }
}

//Sets the channel the user clicked on as active, udpates and displays all messages and members of the channel
function setActiveChannel(channel) {
    fn.load('./views/chat.html');
    
    if (activeChannel) {
        activeChannel.removeListener('messageAdded', addMessage);
        activeChannel.removeListener('messageRemoved', removeMessage);
        activeChannel.removeListener('messageUpdated', updateMessage);
        activeChannel.removeListener('updated', updateActiveChannel);
        activeChannel.removeListener('memberUpdated', updateMember);
    }

    activeChannel = channel;
    
    var setChannelTitle = setInterval(function() {
        if($('#channel-title').html()!==undefined){
            $('#channel-title').html(channel.friendlyName);
            clearInterval(setChannelTitle);
        }
    }, 100);
    
    $('#channel-messages ul').empty();
    $('#channel-members ul').empty();
    activeChannel.getAttributes().then(function(attributes) {
        $('#channel-desc').text(attributes.description);
    });

    $('#send-message').off('click');
    $('body').delegate('#send-message', 'click', function() {
        var body = $('#message-body-input').val();
        channel.sendMessage(body).then(function() {
            $('#message-body-input').val('').focus();
            $('#channel-messages').scrollTop($('#channel-messages ul').height());
            $('#channel-messages li.last-read').removeClass('last-read');
        });
    });

    activeChannel.on('updated', updateActiveChannel);

    $('#no-channel').hide();
    $('#channel').show();

    if (channel.status !== 'joined') {
        $('#channel').addClass('view-only');
        return;
    } else {
        $('#channel').removeClass('view-only');
    }

    channel.getMessages(30).then(function(page) {
        activeChannelPage = page;
        page.items.forEach(addMessage);

        channel.on('messageAdded', addMessage);
        channel.on('messageUpdated', updateMessage);
        channel.on('messageRemoved', removeMessage);

        var newestMessageIndex = page.items.length ? page.items[page.items.length - 1].index : 0;
        var lastIndex = channel.lastConsumedMessageIndex;
        
        if (lastIndex && lastIndex !== newestMessageIndex) {
            var $li = $('li[data-index='+ lastIndex + ']');
            var top = $li.position() && $li.position().top;
            $li.addClass('last-read');            
            $('#channel-messages').scrollTop(top + $('#channel-messages').scrollTop());
        }

        if ($('#channel-messages ul').height() <= $('#channel-messages').height()) {
            channel.updateLastConsumedMessageIndex(newestMessageIndex).then(updateChannels);
        }

        return channel.getMembers();
    }).then(function(members) {
        updateMembers();

        channel.on('memberJoined', updateMembers);
        channel.on('memberLeft', updateMembers);
        channel.on('memberUpdated', updateMember);

        members.forEach(member => {
            member.userInfo.on('updated', () => {
                updateMember.bind(null, member);
                updateMembers();
            });
        });
    });

    //Shows when another member of the channel is currently typing a message
    channel.on('typingStarted', function(member) {
        typingMembers.add(member.userInfo.friendlyName || member.userInfo.identity);
        updateTypingIndicator();
    });

    channel.on('typingEnded', function(member) {
        typingMembers.delete(member.userInfo.friendlyName || member.userInfo.identity);
        updateTypingIndicator();
    });

    $('#message-body-input').focus();
}

function clearActiveChannel() {
    $('#channel').hide();
    $('#no-channel').show();
}

function updateActiveChannel() {
    $('#channel-title').text(activeChannel.friendlyName);
    $('#channel-desc').text(activeChannel.attributes.description);
}

function updateTypingIndicator() {
    var message = 'Typing: ';
    var names = Array.from(typingMembers).slice(0,3);

    if (typingMembers.size) {
        message += names.join(', ');
    }

    if (typingMembers.size > 3) {
        message += ', and ' + (typingMembers.size-3) + 'more';
    }

    if (typingMembers.size) {
        message += '...';
    } else {
        message = '';
    }
    $('#typing-indicator span').text(message);
}

//Not sure what this is user for. It seems like it does not get called anywhere.
function updateWithIncorrectToken() {
    let identity = userContext.identity;
    let randomEndpointId = Math.random().toString(36).substring(7);
    $.ajax({
        url: 'https://www.microtrain.net/twilio/twilio/test_token/' + identity + '/' + randomEndpointId +'/',
        type: "GET",
        success: function(data, textStatus, jqXHR) {
            console.log('Got new token!', data);
            accessManager.updateToken(data);
        },
        error: function(jqXHR, textStatus, errorThrown) {
            console.error('Failed to get a token ', data);
            throw new Error(errorThrown);
        }
    });
}

function showPopover(target) {
    $('#'+target).show();
}

function hidePopover(target) {
    $('#'+target).hide();
}