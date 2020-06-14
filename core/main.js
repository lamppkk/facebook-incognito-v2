chrome.runtime.onMessage.addListener(async (request, sender, callback) => {
    switch(request.action)
    {
        case INIT_APP:
            createContextMenu();
            if (chrome.webRequest.onBeforeRequest.hasListener(blockRequest))  {
                chrome.webRequest.onBeforeRequest.removeListener(blockRequest);
            }
            try {
                chrome.webRequest.onBeforeRequest.addListener(blockRequest, {
                    urls: ['<all_urls>']
                }, ['blocking', 'requestBody']);  
            } catch(e) {
                console.log(e);
            }  
        break;
        case SET_SELECTED_ELEMENT:
            sessionStorage.setItem('targetSelected', request.payload);
        break;
        case 'SET_DEAD_BADGE':
            let currentDead = parseInt(localStorage.getItem('dead')) || 0;
            localStorage.setItem('dead', ++currentDead);
            setDeadBadge();
        break;
    }

    function createContextMenu()
    {
        if(!sessionStorage.getItem('isMenuCreated'))
        {
            chrome.contextMenus.create({
                title: 'Fly Color', 
                contexts:['all'], 
                onclick: banUser
            });
            sessionStorage.setItem('isMenuCreated', true);
        }
    }

    function blockRequest(details) {
        try {
            let currentBlocking = localStorage.getItem('blocked') || '';
            details.url = details.url.split('?') ? details.url.split('?')[0] : details.url;
            if(details.url.includes('https://www.facebook.com/api/graphql/') && details.method == 'POST')
            {
                if(details.requestBody.formData.fb_api_req_friendly_name && currentBlocking.split(',').includes(String(details.requestBody.formData.fb_api_req_friendly_name)))
                {
                    return {
                        cancel: true
                    };
                }
            }
            else if(currentBlocking && currentBlocking.split(',').includes(details.url))
            {
                return {
                    cancel: true
                };
            }
            return {
                cancel: false
            }
        }
        catch(e) {
            console.log(e);
        }
    }

    function createMessageBox(message, status, time)
    {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
            chrome.tabs.sendMessage(tabs[0].id || null, {action: 'CREATE_MESSAGE_BOX',message, status, time});  
        });
    }

    function setDeadBadge()
    {
        let flyColorSetting = JSON.parse(localStorage.getItem('flyColorSetting')) || {
            showDeadBadge: true
        };
        let currentDead = parseInt(localStorage.getItem('dead')) || 0;
        let text = flyColorSetting.showDeadBadge ? `${currentDead}` : '';  
        chrome.browserAction.setBadgeText({text});
    }

    setDeadBadge();

    async function banUser(info, tab) {
        try
        {
            let flyColorSetting = JSON.parse(localStorage.getItem('flyColorSetting'));
            let actor = JSON.parse(localStorage.getItem('actor'));  
            let targetSelected = JSON.parse(sessionStorage.getItem('targetSelected'));
            if(flyColorSetting !== null && actor !== null && targetSelected !== null)
            {
                let groupId = flyColorSetting.multipleGroups ? targetSelected.groupId : parseInt(flyColorSetting.groupId);
                flyColorSetting.ignoreMemberId = flyColorSetting.ignoreMemberId || '';
                if(flyColorSetting.ignoreMemberId.length == 0 || !flyColorSetting.ignoreMemberId.split("\n").includes(targetSelected.userId))
                {
                    if(groupId && targetSelected.userId != targetSelected.groupId)
                    {
                        if(confirm(`Xóa ${targetSelected.userName} khỏi nhóm ${targetSelected.groupName}?`))
                        {
                            let option = {
                                fb_dtsg_ag: actor.fb_dtsg,
                                fb_dtsg: actor.fb_dtsg,
                                confirmed: true
                            }
                            option.block_user = flyColorSetting.banForever ? confirm(`[ Tùy Chọn ] Chặn ${targetSelected.userName} vĩnh viễn khỏi nhóm ${targetSelected.groupName}?`) : null;
                            let reason = flyColorSetting.showReason ? prompt('Lí do?') : '';   
                            let message = flyColorSetting.message.replace('{{ name }}', targetSelected.userName).replace('{{ uid }}', targetSelected.userId).replace('{{ reason }}', reason || '');
                            let payload = { message, targetSelected, groupId, option, flyColorSetting, actor };
                            chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
                                chrome.tabs.sendMessage(tabs[0].id || null, {action: 'BAN_USER', payload});  
                            });
                        }
                        return;
                    }
                    return createMessageBox('Không tìm thấy nhóm, xin vui lòng thử lại', 'error');
                }
                return createMessageBox('Người này nằm trong danh sách bất tử, không thể Fly Color', 'warning');
            }
            createMessageBox('Vui lòng cấu hình Fly Color Click trước khi thực hiện hành động này', 'warning');
        }
        catch(e)
        {
            console.log(e);
            createMessageBox('Đã có lỗi xảy ra, xin vui lòng thử lại', 'error');
        }
    }
});

registerExternalMessageListener();

function registerExternalMessageListener() 
{
    chrome.runtime.onMessageExternal.addListener(
        function (request, sender, sendResponse) 
        {
            if(request.getPersistedMessages) 
            {
                getPersistedMessages(messages => {
                    sendResponse(messages);
                });
            }
            if(request.receivedMessages) 
            {
                setReceivedMessages(request.receivedMessages);
            }
            if(request.removedMessages) 
            {
                setRemovedMessages(request.removedMessages);
            }
            if(request.lastPurgeTime) 
            {
                setLastPurgeTime(request.lastPurgeTime);
            }
            if(request.action == 'AUTO_REP_MESSAGE')
            {
                let actor = JSON.parse(localStorage.getItem('actor'));  
                let setting = JSON.parse(localStorage.getItem('autoRepMessage'));  
                chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
                    chrome.tabs.sendMessage(tabs[0].id || null, {action: 'AUTO_REP_MESSAGE', message: request, actor, setting});  
                });
            }
            return true;
        }
    );
}

function getPersistedMessages(callback) 
{
    chrome.storage.local.get(['receivedMessages', 'removedMessages', 'lastPurgeTime'], function (result) {
        callback(result);
    });
}

function setReceivedMessages(messages) 
{
    chrome.storage.local.set({
        'receivedMessages': messages
    });
}

function setRemovedMessages(messages) 
{
    chrome.storage.local.set({
        'removedMessages': messages
    });
}

function setLastPurgeTime(timestamp) 
{
    chrome.storage.local.set({
        'lastPurgeTime': timestamp
    });
}